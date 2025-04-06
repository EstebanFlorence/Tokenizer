/*
    npx hardhat console --network <sepolia/localhost>
*/

/* Hardhat node */
await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
await ethers.provider.send("evm_mine");

/* Get signers */
[owner, owner2, owner3, user1] = await ethers.getSigners();
owner.address;

/* Get a Deployed Contract Instance */
tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

treasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
treasury = await ethers.getContractAt("Treasury", treasuryAddress);

/* Balance */
ethers.formatEther(await ethers.provider.getBalance(deployer.address));
ethers.formatEther(await tokenizer.balanceOf(deployer.address));

/* Check the total supply of tokens */
ethers.formatEther(await tokenizer.totalSupply());

/* Check roles */
DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
await tokenizer.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
await tokenizer.hasRole(MINTER_ROLE, treasury.target);
await tokenizer.hasRole(BURNER_ROLE, treasury.target);
await tokenizer.hasRole(PAUSER_ROLE, owner.address);

/* Mint tokens (requires MINTER_ROLE) */
await tokenizer.mint(user1.address, ethers.parseEther("100"));
await treasury.proposeMint(user1.address, ethers.parseEther("42"));

/* Burn tokens (requires BURNER_ROLE) */
await tokenizer.burn(user1.address, ethers.parseEther("50"));
await treasury.proposeBurn(user1.address, burnAmount);

/* Pause the contract (requires PAUSER_ROLE) */
await tokenizer.pause();

/* Unpause the contract (requires PAUSER_ROLE) */
await tokenizer.unpause();

/* Trigger a random event */
requestId = await tokenizer.triggerRandomEvent();

/* Approve Multisig transactions */
await treasury.approveTransaction(0);
await treasury.connect(owner2).approveTransaction(0);
// ...

/* Execute Multisig transactions */
await treasury.executeTransaction(0);
