# Tokenizer

Explain the choices you had to make and the reasons why you made these choices.


# Documentation

- https://ethereum.org/en/developers/docs/smart-contracts/anatomy/
- https://ethereum.org/en/developers/docs/smart-contracts/compiling/
- https://docs.ethers.org/v6/

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
- npx hardhat test --typecheck --network localhost

## Deployment
- npm install --save-dev @nomicfoundation/hardhat-toolbox dotenv

Deploying contract with the account: 0xD1CF396C69b77110C562fc257Ac4b3E458037cB2
vrfConsumer deployed at: 0xD36928dfc7196f6e07f46382ff668B58f1E6C2cA
vrfConsumer's coordinator address: 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
Tokenizer deployed at: 0xf8AC3544c7A31b5eB3f596A3a46bB6eD9bC15cA4
Treasury deployed at: 0xaae34b924efd9c3800ef366e64a07109448681dd
Granted MINTER_ROLE to Treasury
Granted BURNER_ROLE to Treasury
Added Tokenizer's vrfConsumer as a VRF consumer.

Tx Hashes:
- 0x6f24a9bf6465f619f26ff3b501f9363a14fa8486917e394093def8cc2b76dea0
- 0x891064a39e8ffbc73af18c50f50c1efaa22453eb35c6dc92cb658900abc52d18
- 0x5dd141054b6780becf1cdc89654462aa6e18acc2df167b62efd67b12f4b6f94b
- 0x2fe3761d5c476ae0f3464a3ecb9b88ecd9d2e453cf342e9d35d122694dac3b16
- 0x2ff89742e4a600552f36d1ee2021f4b0aedb8142205a99124f2ba46219d4c629
- 0x0cecf632f225e82921a0880928a809aa5ca4fb89436010a8d682ce75c86779f5

# Smart Contract
Contract: 
Deployer: 0xD1CF396C69b77110C562fc257Ac4b3E458037cB2
(Multisig Owners)
Owner 2: 0x47571150cd6edab2cc682B0Ec8AdDCA46e13EBBe
Owner 3: 0xa461A0F0f62ADe5dccf92c326a34600F78BE2e72

User calls Tokenizer.triggerRandomEvent()
⬇ Calls
VRFConsumer.requestRandomness() (requests randomness from Chainlink)
⬇ Calls
Chainlink VRF processes and calls VRFConsumer.fulfillRandomWords()
⬇ Stores randomness
Tokenizer fetches randomness using vrfConsumer.getRandomness(requestId)
