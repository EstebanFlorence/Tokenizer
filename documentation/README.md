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
vrfConsumer deployed at: 0x9cEBd1c4F3bf5C68f5f2d417EDf9Ed0aE6d95B6A
vrfConsumer's coordinator address: 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
Tokenizer deployed at: 0xC1510A0839eCbA01a057b2D5447F8e64E88A2b35
Treasury deployed at: 0xA7a0134a5aC5324621259062178652Fc0927530c
Granted MINTER_ROLE to Treasury
Granted BURNER_ROLE to Treasury
Added Tokenizer's vrfConsumer as a VRF consumer.
Dealer deployed at: 0x6d79ae1789eD18a276b7bAFb12Ecf5E2878bCDa6


Tx Hashes:
- 0x79481dea49fa1a8af7c3dc7c3c60ba32141b9c1e300181ddffb9e002f92fc020
- 0xe512b252ee0cd0ffb0c7253ab79650152ddf84cd5618986711bf824477edc62b
- 0x692ee0e15db869a365e345baf24faab5cb6faf8719b328f5a52ccd490aa92826
- 0x75f441601bca0f2c2e5ecdcb3b4a2a38e8924b32674d21c8c32e22f15e9bc3a6
- 0xdb29b102bf42c303a93d9935dbc55f5145b5a5911a96a16474c0387db26a27db
- 0x6d10c4b0ac44fefe8186cf7481166984807113180bf01383f10b6c225b9d9b61
- 0x761df520169b22ecd8ab19831338ee7090b47187884f80445bd1b455beb339f3
- Reverted

Estimated Gas: 
Actual Gas: 

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
