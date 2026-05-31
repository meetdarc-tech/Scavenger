# Scavenger Mobile App

React Native mobile application for iOS and Android platforms.

## Features

- **Waste Submission**: Submit waste materials with type and weight
- **Waste Transfer**: Transfer waste between participants
- **Statistics**: View personal recycling statistics and rewards
- **Profile Management**: Manage participant profile and settings
- **Real-time Updates**: Receive notifications for waste transfers and rewards

## Prerequisites

- Node.js 16+
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)

## Installation

```bash
cd mobile
npm install
```

## Development

### iOS
```bash
npm run ios
```

### Android
```bash
npm run android
```

### Start Metro Bundler
```bash
npm start
```

## Building

### iOS Release Build
```bash
npm run build:ios
```

### Android Release Build
```bash
npm run build:android
```

## Project Structure

```
src/
├── App.tsx              # Main app component with navigation
├── screens/             # Screen components
│   ├── HomeScreen.tsx
│   ├── WasteSubmissionScreen.tsx
│   ├── TransferScreen.tsx
│   ├── ProfileScreen.tsx
│   └── StatsScreen.tsx
├── api/                 # API client
│   └── wasteApi.ts
├── store/               # State management (Zustand)
│   └── appStore.ts
└── types/               # TypeScript types
```

## Environment Variables

Create a `.env` file in the mobile directory:

```
REACT_APP_API_URL=http://localhost:8080
REACT_APP_CONTRACT_ID=your_contract_id
REACT_APP_NETWORK=testnet
```

## Testing

```bash
npm test
```

## Linting

```bash
npm run lint
```

## Contributing

See the main project CONTRIBUTING.md for guidelines.

## License

MIT
