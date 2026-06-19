# VocabCanvas CEFR — Dataset Curation Engine

VocabCanvas CEFR is a professional-grade, interactive dataset curation workspace designed to curate, analyze, and manage vocabulary datasets categorized under the **Common European Framework of Reference for Languages (CEFR)**. 

Featuring an elegant, high-density dashboard, the application allows developers, educators, and language experts to build structured custom corpus files, import bulk data via a reliable CSV processor, and persist everything to an offline-first container or sync it with a remote PostgreSQL database via Supabase.

---

## 🚀 Core Features

- **CEFR Standard Hierarchy**: Quickly browse and categorize words into standard tiers from **A1 (Elementary)** up to **C2 (Proficiency)**.
- **Add Word Wizard**: A clean design modal to configure custom definitions, classification tiers, parts of speech (verbs, nouns, prepositions), and mastery states (*All States, Learning, Familiar, Mastered*).
- **Automated CSV Row Importer**: Streamlined CSV parsing that parses headings and populates customized dictionary entries.
- **Supabase Cloud Sync Panel**: Fully synchronized operations (Push and Pull sync) with standard Row-Level Security (RLS) support to keep client state backed up.
- **Dynamic Indicators**: Interactive progress rings, level density visual meters, and comprehensive structural filters.

---

## ⚙️ Supabase Configuration Guide

To ensure that features like **User Authentication**, **Database Actions**, and target **Password Recovery Redirects** work correctly without 404 errors, follow these setup steps:

### 1. Configure the Site URL & Allowed Redirects
When users click their recovery link in their password reset email, Supabase needs authorization to forward them securely back to your live GitHub Pages repository namespace.

1. Go to your [Supabase Dashboard](https://supabase.com).
2. Select your project **`ojkmqivtyzyqkvpxqaok`** (or your active project container).
3. Navigate to **Authentication** (under the side menu) $\rightarrow$ **URL Configuration**.
4. Configure the following inputs:
   - **Site URL**: 
     ```
     https://bhagavatiprasad.github.io/vocabulary-appV2/
     ```
   - **Redirect URLs** (Add as safe patterns):
     - `https://bhagavatiprasad.github.io/vocabulary-appV2/`
     - `https://bhagavatiprasad.github.io/**` (Wildcard pattern supporting sub-routes)
5. Click **Save Changes**.

---

## 🛠️ Local Development & Deployment

This is a modern front-end application built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**.

### Initial Installation
Install all required dependencies:
```bash
npm install