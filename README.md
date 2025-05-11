# Tokenizer

A blockchain-based project that leverages Chainlink VRF for verifiable randomness in token generation and distribution.

## Overview

This project implements a system of smart contracts for creating, managing, and distributing tokens with randomized characteristics. The system uses Chainlink's Verifiable Random Function (VRF) to ensure fair and transparent randomness in the token generation process.

## Key Components

- **Tokenizer**: Main contract for token generation with randomized attributes
- **VRFConsumer**: Interface with Chainlink VRF for secure randomness
- **Treasury**: Handles token minting and burning operations
- **Dealer**: Manages token distribution

## Quick Start

```bash
# Installation
npm install

# Start local blockchain
npx hardhat node

# Deploy contracts
npx hardhat run --network localhost scripts/deploy.js

# Run tests
npx hardhat test --typecheck --network localhost
```

## Architecture

User calls `Tokenizer.triggerRandomEvent()` → Calls `VRFConsumer.requestRandomness()` → Chainlink VRF processes and returns randomness → `VRFConsumer.fulfillRandomWords()` stores the result → Tokenizer fetches randomness using `vrfConsumer.getRandomness(requestId)`

## Documentation

For detailed documentation including setup instructions, contract specifications, and more, see the [documentation folder](./documentation).

## License

[MIT](LICENSE)