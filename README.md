<div align="center">
  <img width="1200" height="475" alt="Trainers SuperApp Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  # 🚀 Trainers SuperApp
  **The ultimate ecosystem for Contact Center training, evaluation, and quality assurance.**
  
  [![Tech Stack](https://img.shields.io/badge/Stack-Next.js%2015%20%7C%20Supabase-blueviolet)](https://nextjs.org/)
  [![License](https://img.shields.io/badge/Status-MVP%201.1.0-green)](https://github.com/fajarabr76/Trainerssuperappnext)
</div>

---

## 📖 Overview

**Trainers SuperApp** is a robust, multi-module internal platform designed for Contact Center Trainers, Leaders, and QA Officers. It streamlines the entire performance management lifecycle—from agent orientation and skills training to advanced Quality Assurance (QA) analytics.

At its core, the app follows **"The Path to Zero"** philosophy, treating every audit defect as a solvable problem and guiding organizations toward zero-defect quality.

---

## 🧩 Core Modules

### 1. 🛡️ SIDAK (QA Analyzer) — "The Path to Zero"
The centerpiece of the platform. A high-performance analytics dashboard and audit tracking system.
- **Executive Summary**: 4 key KPI cards showing Total Defects, Average Errors per Audit, Fatal Error Rate, and SOP Compliance.
- **Pareto Root Cause Analysis**: Identify the 20% of parameters causing 80% of your quality issues.
- **Team & Agent Performance**: Visualize trends and ranking across different organizational levels.
- **Audit Input**: Integrated interface for QA analysts to enter findings against hierarchical parameters.

### 2. 📇 Profiler (Agent Database)
A comprehensive repository for managing participant and agent data.
- **Hierarchical Folders**: Year > Folder (Batch) > Agent structure for deep organizational hygiene.
- **Photo Automation**: Automatic image compression and upload to secure Supabase Storage.
- **Bulk Operations**: Intelligent Excel imports with custom dropdown validation and multi-export formats (PNG/PDF).
- **Analytics**: Historical performance tracking per agent.

### 3. 🎮 Simulation Suites
Real-time evaluation modules to test and train agent skills in controlled environments:
- **⌨️ KETIK (Chat)**: Real-time chat simulation with AI-driven evaluation.
- **📧 PDKT (Email)**: Email simulation for testing professional correspondence.
- **📞 TELEFUN (Phone)**: Telephony simulation for voice-based audit practice.

---

## 🛠️ Technical Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with RLS, Auth, Storage)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with Glassmorphism and specialized Dark Mode support
- **Visualization**: [Recharts](https://recharts.org/) for interactive data analytics
- **Animation**: [Motion (Framer Motion)](https://motion.dev/)
- **Data Handling**: `SheetJS` (xlsx) and `ExcelJS` for robust spreadsheet processing

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18 or newer
- **Supabase Project**: A deployed Supabase instance (Local or Pro)

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/fajarabr76/Trainerssuperappnext.git
   cd trainers-superapp-next
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Initialize Database Schema**:
   Run the following SQL scripts in your Supabase SQL Editor in order:
   1. `supabase_rbac_setup.sql` (Auth, Profiles, and RLS)
   2. `supabase-profiler-schema.sql` (Profiler-specific tables)
   3. `add_pencatatan_indicators.sql` (Primary metrics and indicators)

5. **Run the development server**:
   ```bash
   npm run dev
   ```

---

## 🔐 Security & RBAC

The application implements a robust **Role-Based Access Control (RBAC)** system using Supabase Row-Level Security (RLS):
- **Trainer/Leader**: Full access to all modules, analytics, and data management.
- **Agent**: Limited access to own performance details and training modules.

---

## 📈 Roadmap

- [x] MVP Dashboard for SIDAK
- [x] Advanced Folder Hierarchy in Profiler
- [ ] Exportable PDF/PPT Performance Reports
- [ ] Real-time Coaching Notifications
- [ ] Cross-module Performance Correlations

---

<div align="center">
  Built with ❤️ by the Trainers SuperApp Team
</div>
