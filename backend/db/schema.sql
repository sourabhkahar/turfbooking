-- Turf Booking System Database Schema
CREATE DATABASE IF NOT EXISTS turf_booking;
USE turf_booking;

-- Users table (super_admin, owner, user)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'owner', 'user') DEFAULT 'user',
  phone VARCHAR(20),
  status ENUM('active', 'disabled') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Turfs table
CREATE TABLE IF NOT EXISTS turfs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  location VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  sport_type VARCHAR(100) DEFAULT 'Football',
  facilities TEXT, -- JSON string of facilities array
  images TEXT,     -- JSON string of image URLs
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Slots table
CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turf_id INT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('available', 'blocked', 'booked') DEFAULT 'available',
  block_reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_slot (turf_id, date, start_time),
  FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE
);

-- Pricing rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  turf_id INT NOT NULL,
  rule_type ENUM('base', 'custom') DEFAULT 'base',
  day_of_week TINYINT DEFAULT NULL, -- 0=Sunday, 1=Monday ... 6=Saturday, NULL = all days
  start_time TIME DEFAULT NULL,     -- custom slot time range start
  end_time TIME DEFAULT NULL,       -- custom slot time range end
  price_per_hour DECIMAL(10,2) NOT NULL,
  label VARCHAR(100), -- e.g. "Weekend rate", "Evening rate"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slot_id INT NOT NULL,
  user_id INT NOT NULL,
  turf_id INT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours DECIMAL(4,2) NOT NULL,
  price_per_hour DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
  cancellation_reason TEXT,
  payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',
  payment_id VARCHAR(255) DEFAULT NULL,  -- Razorpay payment ID (future)
  razorpay_order_id VARCHAR(255) DEFAULT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE
);

-- Booking Tokens table
CREATE TABLE IF NOT EXISTS booking_tokens (
  token VARCHAR(255) PRIMARY KEY,
  turf_id INT NOT NULL,
  slot_id INT DEFAULT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_by INT NOT NULL,
  expires_at DATETIME NOT NULL,
  status ENUM('active', 'used', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (turf_id) REFERENCES turfs(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Seed: Default super admin (password: Admin@123)
INSERT IGNORE INTO users (name, email, password_hash, role, status) VALUES
('Super Admin', 'admin@turf.com', '$2b$10$jy58R9.7pkBiyp41QfG.a3nliYAAaNIbYHos5jsZ.yvtzmhta', 'super_admin', 'active');
