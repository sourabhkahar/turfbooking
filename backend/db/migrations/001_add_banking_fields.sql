-- Migration: Add banking/payout fields to users, update payouts table
USE turf_booking;

-- Add banking fields to users table (for owners)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(15) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pan VARCHAR(12) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_contact_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id VARCHAR(100) DEFAULT NULL;

-- Update payouts table structure for Razorpay integration
ALTER TABLE payouts
  ADD COLUMN IF NOT EXISTS razorpay_payout_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payout_mode ENUM('bank_account','upi') DEFAULT 'bank_account',
  ADD COLUMN IF NOT EXISTS failure_reason TEXT DEFAULT NULL;

-- Make sure payouts table has payout_id column if not created yet
CREATE TABLE IF NOT EXISTS payouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0.00,
  final_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','processed','failed') DEFAULT 'pending',
  payout_mode ENUM('bank_account','upi') DEFAULT 'bank_account',
  period_start DATETIME,
  period_end DATETIME,
  processed_at DATETIME,
  transaction_ref VARCHAR(255),
  razorpay_payout_id VARCHAR(100) DEFAULT NULL,
  razorpay_fund_account_id VARCHAR(100) DEFAULT NULL,
  failure_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Make sure bookings has payout_id column
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payout_id INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_status ENUM('pending','paid','fully_paid','refunded') DEFAULT 'pending';
