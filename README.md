# AI Fraud Detector - Secure Banking Solutions

A comprehensive AI-powered fraud detection system with real-time transaction monitoring, user authentication, and SMS verification for suspicious activities.

## 🚀 Features

### 🔒 Security Features
- **AI-Powered Fraud Detection**: Advanced behavioral analysis and geo-location tracking
- **Real-Time Monitoring**: Instant fraud detection with immediate alerts
- **Smart Blacklisting**: Automatic blacklisting of suspicious accounts and IPs
- **SMS Verification**: Secure PIN verification for flagged transactions
- **User Authentication**: Secure login/signup with encrypted password storage

### 🧠 AI Detection Capabilities
- **Behavioral Analysis**: Detects unusual spending patterns using statistical analysis
- **Geo-Location Tracking**: Monitors geographic anomalies in transaction locations
- **IP Blacklisting**: Automatically blocks known fraudulent IP addresses
- **Amount Anomaly Detection**: Uses Z-score analysis to identify suspicious amounts

### 💻 User Interface
- **Modern Responsive Design**: Beautiful, mobile-friendly interface
- **Real-Time Notifications**: Instant feedback for all operations
- **Interactive Dashboard**: Comprehensive transaction monitoring
- **Smooth Animations**: Professional UI with engaging animations

## 🛠 Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **MongoDB**: NoSQL database for flexible data storage
- **NumPy**: Advanced statistical analysis
- **Geopy**: Geographic distance calculations
- **Pydantic**: Data validation and serialization

### Frontend
- **HTML5/CSS3**: Modern web standards
- **JavaScript (ES6+)**: Interactive functionality
- **Font Awesome**: Professional icons
- **CSS Grid/Flexbox**: Responsive layouts

## 📋 Prerequisites

- Python 3.8+
- MongoDB (local or cloud instance)
- Modern web browser
- (Optional) Twilio account for real SMS integration

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-repository-url>
cd ai-fraud-detector
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Set Up Environment Variables
```bash
cp .env.example .env
```

Edit the `.env` file with your MongoDB connection details:
```env
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=fraud_detector
MONGO_COLLECTION_NAME=transactions
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# Using MongoDB service
sudo systemctl start mongod

# Or using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Start the Backend Server
```bash
uvicorn main:app --reload --port 8000
```

### 6. Open the Frontend
Open `index.html` in your web browser or serve it using a local server:
```bash
# Using Python's built-in server
python -m http.server 8080

# Or using Node.js live-server
npx live-server --port=8080
```

Visit `http://localhost:8080` in your browser.

## 📖 Usage Guide

### 1. User Registration
1. Click "Sign Up" in the top-right corner
2. Fill in your details:
   - Full Name
   - Bank Account Number
   - Phone Number (for SMS alerts)
   - Password
   - 4-digit Security PIN
3. Click "Create Account"

### 2. User Login
1. Click "Login" and enter your credentials
2. You'll be redirected to the transaction dashboard

### 3. Processing Transactions
1. Fill in the transaction details:
   - Transaction ID
   - Timestamp (auto-filled with current time)
   - Amount
   - Currency
   - Location
   - Card Type
   - Recipient Account
2. Click "Process Transaction"
3. View the fraud analysis results

### 4. SMS Verification (for Suspicious Transactions)
1. If fraud is detected, an SMS alert is sent (simulated in console)
2. A verification modal appears
3. Enter your 4-digit security PIN
4. Transaction is approved if PIN is correct
5. If PIN is incorrect, the recipient account is blacklisted

## 🔧 Configuration

### MongoDB Collections
The system creates the following collections:
- `transactions`: Stores all transaction data
- `blacklist`: Stores blacklisted accounts and IPs
- `users`: Stores user account information

### Fraud Detection Parameters
You can adjust fraud detection sensitivity by modifying these parameters in `main.py`:
- `window_size`: Number of past transactions to analyze (default: 5)
- `z_thresh`: Z-score threshold for anomaly detection (default: 2.5)
- `max_km`: Maximum distance for geo-drift detection (default: 500km)

### SMS Integration (Optional)
To enable real SMS notifications, uncomment the Twilio code in `main.py` and add your credentials to `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

## 🔍 API Endpoints

### Authentication
- `POST /signup` - Register a new user
- `POST /login` - User login
- `POST /verify_pin` - Verify security PIN

### Transactions
- `POST /check_fraud` - Process and analyze transaction
- `GET /transactions` - Get all transactions
- `GET /user/{account}/transactions` - Get user-specific transactions

### Utilities
- `GET /blacklist` - Get blacklisted entries
- `GET /user/{account}` - Get user information
- `GET /health` - Health check endpoint

## 🧪 Testing

### Test Fraud Detection
1. Create a user account
2. Process a normal transaction (should pass)
3. Process a transaction with:
   - Very high amount (triggers behavioral anomaly)
   - Different location (triggers geo-drift)
   - Blacklisted recipient account
4. Verify SMS verification workflow

### Sample Test Data
```json
{
  "transaction_id": "TXN123456",
  "timestamp": "2024-01-15 14:30:00",
  "amount": 10000.00,
  "location": "Mumbai",
  "card_type": "VISA-1234",
  "currency": "INR",
  "recipient_account": "ACC789012"
}
```

## 🔐 Security Features

### Password Security
- Passwords are hashed using SHA-256
- PINs are encrypted before storage
- No sensitive data is logged

### Transaction Security
- Real-time fraud detection
- Automatic blacklisting of suspicious accounts
- SMS verification for high-risk transactions
- IP-based blocking

### Data Protection
- Secure API endpoints
- Input validation and sanitization
- CORS protection configured

## 🚀 Deployment

### Production Deployment
1. Set up a production MongoDB instance
2. Configure environment variables for production
3. Use a production WSGI server like Gunicorn:
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```
4. Set up reverse proxy with Nginx
5. Enable HTTPS with SSL certificates

### Docker Deployment (Optional)
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the API documentation at `http://localhost:8000/docs` (when server is running)

## 🔮 Future Enhancements

- Machine Learning model integration
- Real-time dashboard with WebSocket updates
- Advanced reporting and analytics
- Multi-factor authentication
- Mobile app development
- Integration with banking APIs

---

**⚠️ Important Security Note**: This is a demonstration system. For production use, implement additional security measures, use proper encryption, and follow banking security standards.
