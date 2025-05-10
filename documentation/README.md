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
vrfConsumer deployed at: 0xbAF70C4f7C0Ce4D13efB82743E0Aa2780e1c5B80
vrfConsumer's coordinator address: 0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B
Tokenizer deployed at: 0x4DfFf400ca6cd6f38286baa1cF8CbD6e139d8715
Treasury deployed at: 0xF7ce95980a7CdC2ECcec0Fe7E9Fd449dB16bB323
Granted MINTER_ROLE to Treasury
Granted BURNER_ROLE to Treasury
Added Tokenizer's vrfConsumer as a VRF consumer.
Dealer deployed at: 0xD6ed3723ebe7Cc9d965F8346B00119BCcB233Ba0

Tx Hashes:
- 0x0700c20f90aee68009439c227b9c78289811c6211fac9c3e2b929b1765c6141a
- 0x1c3c3c275500a87b5ccb359fbbf209b359805f5cea8c48b114475a183c119ccc
- 0x5db49dec4e6008c2bb4d0919fad3f7dfcf50258d13873664c5aaec0ac5253755
- 0x4786ea044adb93085e028224bb543737080b7e02103254c48b6432fee994713d
- 0x4e393579966a6e3cd52c6a67950684159cf5b16d978d711c7cd24eec4afa66d3
- 0x66877f62be8909e933fd855b468336e609898957f74aebb6d32a7ba22df398e4
- 0x63da64d430baba0de72914cb506ec0ed6c2b8bbd63b27fea3d80f9272be251e4

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
