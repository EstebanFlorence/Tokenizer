# Usage Guide for Tokenizer

## Introduction
The Tokenizer is an ERC20 token that allows users to mint and burn tokens based on random events triggered through Chainlink's Verifiable Random Function (VRF). This guide provides instructions on how to interact with the Tokenizer smart contracts, including minting, burning, and managing roles.

## Prerequisites
Before using the Tokenizer, ensure you have the following:
- A wallet that supports Ethereum (e.g., MetaMask).
- Some Ether in your wallet for transaction fees.
- Access to the deployed Tokenizer smart contract on the Ethereum network.

## Interacting with the Tokenizer

### 1. Minting Tokens
To mint tokens, you must have the `MINTER_ROLE` assigned to your address. Follow these steps:

- Call the `proposeMint(address to, uint256 amount)` function from the Treasury contract.
- Provide the recipient's address and the amount of tokens to mint.
- The transaction will require approval from the multisig owners.

### 2. Burning Tokens
To burn tokens, you must have the `BURNER_ROLE` assigned to your address. Follow these steps:

- Call the `proposeBurn(address from, uint256 amount)` function from the Treasury contract.
- Provide the address from which tokens will be burned and the amount to burn.
- The transaction will require approval from the multisig owners.

### 3. Triggering Random Events
To trigger a random event, follow these steps:

- Call the `triggerRandomEvent()` function from the Tokenizer contract.
- Ensure that the required time interval has passed since the last random event.
- This function will request randomness from the VRF consumer.

### 4. Handling Randomness
Once the randomness is fulfilled, the `handleRandomness(uint256 requestId)` function will be called:

- This function will determine whether to mint or burn tokens based on the randomness result.
- The amount of tokens affected will be a percentage of the total supply.

## Role Management
The Tokenizer contract uses role-based access control. The following roles are available:

- **MINTER_ROLE**: Allows the holder to mint tokens.
- **BURNER_ROLE**: Allows the holder to burn tokens.
- **PAUSER_ROLE**: Allows the holder to pause and unpause the contract.

Roles can be assigned and managed by the contract owner.

## Conclusion
The Tokenizer provides a unique way to interact with an ERC20 token through randomness. By following this guide, you can effectively mint, burn, and manage your tokens while utilizing the features of the smart contracts. For further details, refer to the API reference and the whitepaper.