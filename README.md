# Tokenizer

Explain the choices you had to make and the reasons why you made these choices.

# Documentation

- https://docs.openzeppelin.com/learn/
- https://ethereum.org/en/developers/docs/smart-contracts/anatomy/
- https://ethereum.org/en/developers/docs/smart-contracts/compiling/
- https://medium.com/coinmonks/blockscores-45e0c062de5e

# Usage

## Installation
- npm init -y
- npm install --save-dev hardhat
- npm install @openzeppelin/contracts
- npm install --save-dev @nomicfoundation/hardhat-ethers ethers
- npx hardhat init [empty hardhat.config.js]

## Setup
- npx hardhat node
- npx hardhat run --network localhost scripts/deploy.js

## Test
- npm install --save-dev @nomicfoundation/hardhat-toolbox
- npm install --save-dev @openzeppelin/test-helpers
- npx hardhat console --network localhost
- npx hardhat test (test/Tokenizer.test.js)
