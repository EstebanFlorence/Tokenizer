/*
	npx hardhat console --network <sepolia/localhost>
*/

/* Hardhat node */
await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
await ethers.provider.send("evm_mine");

/* Get signers */
[deployer, owner2, owner3, user1] = await ethers.getSigners();
deployer.address;

/* Get a Deployed Contract Instance */
// Localhost
tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
// Sepolia
tokenizerAddress = "0xf8AC3544c7A31b5eB3f596A3a46bB6eD9bC15cA4";

tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

// Localhost
treasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
// Sepolia
treasuryAddress = "0xaae34b924efd9c3800ef366e64a07109448681dd";

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
await tokenizer.hasRole(PAUSER_ROLE, deployer.address);

/* Grant role */
await tokenizer.grantRole((await tokenizer.DEFAULT_ADMIN_ROLE()), deployer.address);
await tokenizer.grantRole((await tokenizer.MINTER_ROLE()), deployer.address);
await tokenizer.grantRole((await tokenizer.BURNER_ROLE()), deployer.address);
await tokenizer.grantRole((await tokenizer.PAUSER_ROLE()), deployer.address);

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

// Send ETH to owner2
await deployer.sendTransaction({
	to: owner2.address,
	value: ethers.parseEther("0.1")
});

// Send ETH to owner3
await deployer.sendTransaction({
	to: owner3.address,
	value: ethers.parseEther("0.1")
});
