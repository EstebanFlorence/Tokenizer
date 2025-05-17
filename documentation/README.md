# Tokenizer - Technical Documentation

## Project Overview

The Tokenizer project is a blockchain system that leverages Chainlink VRF (Verifiable Random Function) to generate tokens with verifiably random characteristics. This document outlines the implementation details, setup procedures, and design choices.

## Design Choices

This section explains the key design decisions and architectural choices made during development.

### VRF Implementation

Chainlink VRF to provide secure and verifiable randomness that cannot be manipulated by miners, users, or even the developers of the system. This ensures fair token generation and distribution.

### Contract Architecture

The project uses a modular design with separate contracts for specific functions:
- **Tokenizer**: Core contract handling token logic
- **VRFConsumer**: Interface with Chainlink for randomness
- **Treasury**: Token minting and burning with role-based access control
- **Dealer**: Token distribution and sales

## Technical References

### Ethereum Development
- [Smart Contract Anatomy](https://ethereum.org/en/developers/docs/smart-contracts/anatomy/)
- [Smart Contract Compilation](https://ethereum.org/en/developers/docs/smart-contracts/compiling/)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

### OpenZeppelin
- [OpenZeppelin Learn](https://docs.openzeppelin.com/learn/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/)

### Chainlink VRF
- [VRF Homepage](https://vrf.chain.link/)
- [Getting Started with VRF v2.5](https://docs.chain.link/vrf/v2-5/getting-started)
- [Random Number Generation Guide](https://docs.chain.link/vrf/v2-5/subscription/get-a-random-number)
- [Supported Networks](https://docs.chain.link/vrf/v2-5/supported-networks)

## Development Guide

### Installation

```bash
# Initialize project
npm init -y

# Install dependencies
npm install --save-dev hardhat
npm install @openzeppelin/contracts
npm install --save-dev @nomicfoundation/hardhat-ethers ethers
npm install @chainlink/contracts --save
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install --save-dev @openzeppelin/test-helpers
npm install --save-dev @nomicfoundation/hardhat-toolbox dotenv
npm install --save-dev @nomicfoundation/hardhat-verify
npm install --save-dev @nomicfoundation/hardhat-etherscan

# Initialize Hardhat
npx hardhat init  # Choose empty hardhat.config.js
```

### Local Development Setup

```bash
# Start local node
npx hardhat node

# Deploy contracts to local network
npx hardhat run --network localhost scripts/deploy.js
```

### Testing

```bash
# Run interactive console
npx hardhat console --network localhost

# Run test suite
npx hardhat test --typecheck --network localhost
```

### Verifying

```bash
# 1. VRFConsumer
npx hardhat verify --network sepolia \
  $VRF_CONSUMER_ADDRESS \
  $VRF_COORDINATOR_ADDRESS \
  $VRF_SUBSCRIPTION_ID \
  $VRF_KEY_HASH

# 2. Tokenizer
npx hardhat verify --network sepolia \
  $TOKENIZER_ADDRESS \
  $INITIAL_SUPPLY \
  $VRF_CONSUMER_ADDRESS

# 3. Treasury
npx hardhat verify \
  --network sepolia \
  --constructor-args scripts/args‑treasury.js \
  $TREASURY_ADDRESS

# 4. Dealer
npx hardhat verify --network sepolia \
  $DEALER_ADDRESS \
  $VRF_CONSUMER_ADDRESS \
  $TOKENIZER_ADDRESS \
  $TREASURY_ADDRESS \
  500 \
  500000 \
  250

```


## Deployment Information

### Latest Deployment

- **Deployer Address**: `0xD1CF396C69b77110C562fc257Ac4b3E458037cB2`
- **VRFConsumer**: `0xcd1f78b04a843A0cC6D042EAB30B2e8BF16Ff126`
- **VRF Coordinator**: `0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B`
- **Tokenizer**: `0x79fa86D2F598AF9473e120B3c3441458417A05D8`
- **Treasury**: `0x6E098f1490a68a55D3f32e22a826dF9CB5fAd1c4`
- **Dealer**: `0x021F426B093B7343FBEAc6DDccf7f1F043bd6379`

### Multisig Owners
- Owner 1: `0xD1CF396C69b77110C562fc257Ac4b3E458037cB2` (Deployer)
- Owner 2: `0x47571150cd6edab2cc682B0Ec8AdDCA46e13EBBe`
- Owner 3: `0xa461A0F0f62ADe5dccf92c326a34600F78BE2e72`

### Transaction History
- VRFConsumer deployment: `0x0632a869fe59e80a74096ae4304672517dd2342631dd93556aad41aa0c5b7d2c`
- Tokenizer deployment: `0x025bb39a1f66a46c60425d98341dfb5a6e463a2a7927b3013a3a1df289a81e1e`
- Treasury deployment: `0x78c1138cc5c50d7784c7e21ba5788d02bbcbd6a4db3909f7dc33b087ab7dd5d7`
- Grant MINTER_ROLE: `0x1e106d6578d865ee8851599e350640eaa6174148a4484cec99ee22256432cb59`
- Grant BURNER_ROLE: `0x4bc948a9ae8bb9750146eeff3134af9e669ddbfac9b09ee5c4a81e242cb49e57`
- VRF consumer addition: `0x206e0c66defb8b59c717c6aaa7953647ac492fb564cb9aa33a93128640f367f3`
- Dealer deployment: `0x043374f183c579dc8437f7cc51745978ac8be10a541162ebed769ad69777812b`

### Gas Cost
- Total estimated gas: 6496361n
- Total estimated gas cost: 0.007597054853598292 ETH
- Total gas: 
- Total gas cost:  ETH


## System Flow

The system works as follows:

```
User calls Tokenizer.triggerRandomEvent()
  ↓
VRFConsumer.requestRandomness() (requests randomness from Chainlink)
  ↓
Chainlink VRF processes and calls VRFConsumer.fulfillRandomWords()
  ↓
VRFConsumer stores randomness
  ↓
Tokenizer fetches randomness using vrfConsumer.getRandomness(requestId)
