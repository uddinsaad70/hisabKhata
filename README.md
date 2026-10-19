# HisabKhata (হিসাবখাতা)

Offline-first Customer Ledger (বাকি ও দেনা-পাওনার খাতা) and Cashbook (দৈনিক জমা-খরচ খাতা) mobile application for Android and iOS, with a custom Node.js + Express + Prisma + PostgreSQL sync backend.

## Monorepo Structure

- apps/mobile/ — React Native + Expo + TypeScript + Expo Router + SQLite mobile app (Phase 1 MVP & Phase 2 Sync Client)
- apps/api/ — Node.js + Express + Prisma + PostgreSQL sync backend (Phase 2)
- docs/ — Project Specification (hishabkhata_app_specificationV2.md) and Master Checkpoints (CHECKPOINTS.md)

## Getting Started (Mobile App)

`powershell
Set-Location apps/mobile
npx expo start
