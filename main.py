from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.encoders import jsonable_encoder
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime
from geopy.distance import geodesic
import os
import numpy as np
import hashlib
import secrets
from typing import Optional

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME")
COLLECTION_NAME = os.getenv("MONGO_COLLECTION_NAME")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]
blacklist_collection = db["blacklist"]
users_collection = db["users"]

app = FastAPI()

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8080", "*"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

location_lookup = {
    "Chennai": (13.0827, 80.2707),
    "Mumbai": (19.0760, 72.8777),
    "Delhi": (28.6139, 77.2090),
    "Bangalore": (12.9716, 77.5946),
}

# Track accepted last known location per card
last_known_location = {}

# Sample blacklisted IPs
BLACKLISTED_IPS = {
    "203.0.113.5",
    "198.51.100.10",
    "45.33.32.156"
}


class Transaction(BaseModel):
    transaction_id: str
    timestamp: str  # Format: "2025-08-07 16:55:00"
    amount: float
    location: str
    card_type: str
    currency: str
    recipient_account: str


class User(BaseModel):
    name: str
    account: str
    phone: str
    password: str
    pin: str


class LoginData(BaseModel):
    account: str
    password: str


class PinVerification(BaseModel):
    account: str
    pin: str
    transaction: Transaction


def hash_password(password: str) -> str:
    """Hash password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return hashlib.sha256(password.encode()).hexdigest() == hashed_password


def send_sms_notification(phone: str, message: str) -> bool:
    """
    Simulate SMS sending - In production, integrate with SMS service like Twilio
    For now, we'll just log the message
    """
    print(f"SMS to {phone}: {message}")
    # In production, you would integrate with an SMS service:
    # from twilio.rest import Client
    # client = Client(account_sid, auth_token)
    # client.messages.create(body=message, from_='+1234567890', to=phone)
    return True


@app.post("/signup")
async def signup(user: User):
    """Register a new user"""
    try:
        # Check if user already exists
        existing_user = users_collection.find_one({"account": user.account})
        if existing_user:
            return {"success": False, "message": "Account already exists"}
        
        # Validate PIN format
        if not user.pin.isdigit() or len(user.pin) != 4:
            return {"success": False, "message": "PIN must be exactly 4 digits"}
        
        # Hash password and PIN
        hashed_password = hash_password(user.password)
        hashed_pin = hash_password(user.pin)
        
        # Create user document
        user_doc = {
            "name": user.name,
            "account": user.account,
            "phone": user.phone,
            "password": hashed_password,
            "pin": hashed_pin,
            "created_at": datetime.now(),
            "is_active": True
        }
        
        # Insert user into database
        result = users_collection.insert_one(user_doc)
        
        if result.inserted_id:
            # Send welcome SMS
            send_sms_notification(user.phone, f"Welcome to AI Fraud Detector! Your account {user.account} has been created successfully.")
            return {"success": True, "message": "Account created successfully"}
        else:
            return {"success": False, "message": "Failed to create account"}
            
    except Exception as e:
        print(f"Signup error: {e}")
        return {"success": False, "message": "Internal server error"}


@app.post("/login")
async def login(login_data: LoginData):
    """Authenticate user login"""
    try:
        # Find user in database
        user = users_collection.find_one({"account": login_data.account})
        
        if not user:
            return {"success": False, "message": "Account not found"}
        
        # Verify password
        if not verify_password(login_data.password, user["password"]):
            return {"success": False, "message": "Invalid password"}
        
        # Check if account is active
        if not user.get("is_active", True):
            return {"success": False, "message": "Account is deactivated"}
        
        # Return user info (excluding sensitive data)
        user_info = {
            "name": user["name"],
            "account": user["account"],
            "phone": user["phone"]
        }
        
        return {"success": True, "user": user_info, "message": "Login successful"}
        
    except Exception as e:
        print(f"Login error: {e}")
        return {"success": False, "message": "Internal server error"}


@app.post("/verify_pin")
async def verify_pin(pin_data: PinVerification):
    """Verify user PIN for suspicious transactions"""
    try:
        # Find user in database
        user = users_collection.find_one({"account": pin_data.account})
        
        if not user:
            return {"success": False, "message": "User not found"}
        
        # Verify PIN
        if not verify_password(pin_data.pin, user["pin"]):
            # PIN is incorrect - blacklist the recipient account
            recipient_account = pin_data.transaction.recipient_account
            
            # Check if already blacklisted
            if not blacklist_collection.find_one({"type": "account", "value": recipient_account}):
                blacklist_collection.insert_one({
                    "type": "account",
                    "value": recipient_account,
                    "reason": ["Invalid PIN verification - potential fraud"],
                    "timestamp": datetime.now(),
                    "blocked_by": pin_data.account
                })
            
            # Send SMS notification about blocked transaction
            send_sms_notification(
                user["phone"], 
                f"FRAUD ALERT: Transaction to {recipient_account} was blocked due to incorrect PIN. If this wasn't you, contact support immediately."
            )
            
            return {"success": False, "message": "Invalid PIN. Transaction blocked and recipient blacklisted."}
        
        # PIN is correct - approve transaction
        # Update transaction in database to mark as approved
        collection.update_one(
            {"transaction_id": pin_data.transaction.transaction_id},
            {"$set": {"pin_verified": True, "status": "approved", "verified_at": datetime.now()}}
        )
        
        # Send SMS confirmation
        send_sms_notification(
            user["phone"], 
            f"Transaction {pin_data.transaction.transaction_id} of {pin_data.transaction.currency} {pin_data.transaction.amount} has been approved and processed."
        )
        
        return {"success": True, "message": "PIN verified successfully. Transaction approved."}
        
    except Exception as e:
        print(f"PIN verification error: {e}")
        return {"success": False, "message": "Internal server error"}


def detect_behavioral_anomaly(past_txns, current_amount, window_size=5, z_thresh=2.5):
    amounts = [txn["amount"] for txn in past_txns][-window_size:]
    if len(amounts) < 2:
        return False
    mean = np.mean(amounts)
    std = np.std(amounts)
    z_score = abs((current_amount - mean) / std) if std != 0 else 0
    return z_score > z_thresh


def detect_geo_drift(card_type, current_location, max_km=500):
    if current_location not in location_lookup:
        return False

    current_coords = location_lookup[current_location]
    last_location = last_known_location.get(card_type)

    if not last_location or last_location not in location_lookup:
        return False

    last_coords = location_lookup[last_location]
    distance = geodesic(last_coords, current_coords).km
    return distance > max_km


def get_client_ip(request: Request):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host


@app.post("/check_fraud")
async def check_fraud(txn: Transaction, request: Request):
    now = datetime.strptime(txn.timestamp, "%Y-%m-%d %H:%M:%S")
    reasons = []
    is_fraud = False

    client_ip = get_client_ip(request)

    # Check if IP is blacklisted
    if client_ip in BLACKLISTED_IPS:
        reasons.append(f"Blacklisted IP Address: {client_ip}")
        is_fraud = True

    # Check if recipient account is blacklisted
    if blacklist_collection.find_one({"type": "account", "value": txn.recipient_account}):
        reasons.append(f"Blacklisted Recipient Account: {txn.recipient_account}")
        is_fraud = True

    # Get past transactions for the card
    past_txns = list(collection.find({"card_type": txn.card_type}).sort("timestamp", 1))

    # Behavioral anomaly detection
    if detect_behavioral_anomaly(past_txns, txn.amount):
        reasons.append("Abnormal Amount (Behavioral)")
        is_fraud = True

    # Geo drift detection
    if detect_geo_drift(txn.card_type, txn.location):
        reasons.append("Geo Drift Detected")
        is_fraud = True

    # If no fraud, update last known location
    if not is_fraud:
        last_known_location[txn.card_type] = txn.location

    # Store transaction with initial status
    transaction_doc = {
        "transaction_id": txn.transaction_id,
        "timestamp": now,
        "amount": txn.amount,
        "location": txn.location,
        "card_type": txn.card_type,
        "currency": txn.currency,
        "recipient_account": txn.recipient_account,
        "client_ip": client_ip,
        "is_fraud": bool(is_fraud),
        "fraud_reason": reasons,
        "status": "pending" if is_fraud else "approved",
        "pin_verified": False if is_fraud else True,
        "created_at": datetime.now()
    }
    
    collection.insert_one(transaction_doc)

    # If fraud detected, get user info for SMS
    if is_fraud:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            account = auth_header.split("Bearer ")[1]
            user = users_collection.find_one({"account": account})
            if user:
                # Send SMS alert about suspicious transaction
                send_sms_notification(
                    user["phone"],
                    f"FRAUD ALERT: Suspicious transaction detected for {txn.currency} {txn.amount} to {txn.recipient_account}. Please verify using your PIN if this transaction is legitimate."
                )

    return {"fraud": is_fraud, "reasons": reasons}


@app.get("/transactions")
def get_all_transactions():
    transactions = list(collection.find({}, {"_id": 0}))
    return jsonable_encoder(transactions)


@app.get("/blacklist")
def get_blacklist():
    entries = list(blacklist_collection.find({}, {"_id": 0}))
    return jsonable_encoder(entries)


@app.get("/user/{account}")
async def get_user_info(account: str):
    """Get user information (excluding sensitive data)"""
    try:
        user = users_collection.find_one({"account": account}, {"_id": 0, "password": 0, "pin": 0})
        if user:
            return {"success": True, "user": user}
        else:
            return {"success": False, "message": "User not found"}
    except Exception as e:
        print(f"Get user error: {e}")
        return {"success": False, "message": "Internal server error"}


@app.get("/user/{account}/transactions")
async def get_user_transactions(account: str):
    """Get transactions for a specific user"""
    try:
        # Find user to get their card types or other identifiers
        user = users_collection.find_one({"account": account})
        if not user:
            return {"success": False, "message": "User not found"}
        
        # For now, we'll return all transactions (in production, you'd filter by user)
        transactions = list(collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(50))
        return {"success": True, "transactions": jsonable_encoder(transactions)}
    except Exception as e:
        print(f"Get user transactions error: {e}")
        return {"success": False, "message": "Internal server error"}


# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}