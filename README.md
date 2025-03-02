# Tokenizer

Explain the choices you had to make and the reasons why you made these choices.


# Documentation

- https://ethereum.org/en/developers/docs/smart-contracts/anatomy/
- https://ethereum.org/en/developers/docs/smart-contracts/compiling/

## OpenZeppelin
- https://docs.openzeppelin.com/learn/
- https://docs.openzeppelin.com/contracts/5.x/

## Chainlink Verifiable Randomness Function
- https://vrf.chain.link/
- https://docs.chain.link/vrf/v2-5/getting-started
- https://docs.chain.link/vrf/v2-5/subscription/get-a-random-number
- https://docs.chain.link/vrf/v2-5/supported-networks


# Steps

## Installation
- npm init -y
- npm install --save-dev hardhat
- npm install @openzeppelin/contracts
- npm install --save-dev @nomicfoundation/hardhat-ethers ethers
- npx hardhat init [empty hardhat.config.js]
- npm install @chainlink/contracts --save

## Setup
- npx hardhat node
- npx hardhat run --network localhost scripts/deploy.js

## Test
- npm install --save-dev @nomicfoundation/hardhat-toolbox
- npm install --save-dev @openzeppelin/test-helpers
- npx hardhat console --network localhost
- npx hardhat test (--network localhost) [test/Tokenizer.test.js]

## Deploy
- npm install --save-dev @nomicfoundation/hardhat-toolbox dotenv


# Smart Contract
Address: 0xD1CF396C69b77110C562fc257Ac4b3E458037cB2
Contract: 

User calls Tokenizer.triggerRandomEvent()
⬇ Calls
VRFConsumer.requestRandomness() (requests randomness from Chainlink)
⬇ Calls
Chainlink VRF processes and calls VRFConsumer.fulfillRandomWords()
⬇ Stores randomness
Tokenizer fetches randomness using vrfConsumer.getRandomness(requestId)
