/*
	npx hardhat console --network <sepolia/localhost>
*/

/* Hardhat node */
await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
await ethers.provider.send("evm_mine");



/* Get signers */
[deployer, owner2, owner3, user1] = await ethers.getSigners();


/* Get Deployed Contract Instance */
// Localhost
tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
// Sepolia
// tokenizerAddress = "0xf8AC3544c7A31b5eB3f596A3a46bB6eD9bC15cA4";
tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

vrfConsumerAddress = await tokenizer.vrfConsumer();
vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);

vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);

// Localhost
treasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
// Sepolia
// treasuryAddress = "0xaae34b924efd9c3800ef366e64a07109448681dd";
treasury = await ethers.getContractAt("Treasury", treasuryAddress);

// Localhost
dealerAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
// Sepolia
// dealerAddress = "";
dealer = await ethers.getContractAt("Dealer", dealerAddress);


/* Balance */
ethers.formatEther(await ethers.provider.getBalance(deployer.address));
ethers.formatEther(await tokenizer.balanceOf(deployer.address));
ethers.formatEther(await tokenizer.balanceOf(dealerAddress));
ethers.formatEther(await tokenizer.balanceOf(treasuryAddress));


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


/* Approve Multisig transactions */
await treasury.approveTransaction(0);
await treasury.connect(owner2).approveTransaction(0);
// ...


/* Execute Multisig transactions */
await treasury.executeTransaction(0);


/* Pause the contract (requires PAUSER_ROLE) */
await tokenizer.pause();


/* Unpause the contract (requires PAUSER_ROLE) */
await tokenizer.unpause();


/* Request randomness */
tx = await vrfConsumer.requestRandomness();
receipt = await tx.wait();

filter = vrfConsumer.filters.RandomnessRequested();
events = await vrfConsumer.queryFilter(filter);
requestId = events[events.length - 1].args[0]
await mockVRFCoordinator.fulfillRandomWordsWithOverride(
	requestId,
	vrfConsumerAddress,
	[Math.floor(Math.random() * 2n ** 256n)]
);
randomness = await vrfConsumer.getRandomness(requestId);


/* Trigger a random event */
tx = await treasury.triggerRandomEvent();
receipt = await tx.wait();
filter = treasury.filters.RandomEventTriggered();
events = await treasury.queryFilter(filter);
requestId = events[events.length - 1].args.requestId;
await mockVRFCoordinator.fulfillRandomWordsWithOverride(
	requestId,
	vrfConsumerAddress,
	[Math.floor(Math.random() * 2n ** 256n)]
);
await treasury.handleRandomness(requestId);


/* Send ETH */
await deployer.sendTransaction({
	to: owner2.address,
	value: ethers.parseEther("0.1")
});

await deployer.sendTransaction({
	to: owner3.address,
	value: ethers.parseEther("0.1")
});


/* Get contract interface */
dealerArtifact = JSON.parse(fs.readFileSync("artifacts/contracts/Dealer.sol/Dealer.json", 'utf8'));
iface = new ethers.Interface(dealerArtifact.abi);


/* Blackjack */
function getCardValue(cardNumber) {
	const ranks = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
	const suits = ['Clubs', 'Diamonds', 'Hearts', 'Spades'];

	const rankIndex = (cardNumber - 1n) % 13n; // 0-based index for rank
	const suitIndex = (cardNumber - 1n) / 13n; // 0-based index for suit

	const rank = ranks[Number(rankIndex)];
	const suit = suits[Number(suitIndex)];

	return `${rank} of ${suit}`;
}

await tokenizer.approve(dealerAddress, ethers.parseEther("100000"));
allowance = ethers.formatEther(await tokenizer.allowance(deployer.getAddress(), dealer.getAddress()));

tx = await dealer.startGame(ethers.parseEther("10000"));
receipt = await tx.wait();

randomFilter = vrfConsumer.filters.RandomnessRequested();
randomEvents = await vrfConsumer.queryFilter(randomFilter);
requestId = randomEvents[randomEvents.length - 1].args[0]
await mockVRFCoordinator.fulfillRandomWordsWithOverride(
	requestId,
	vrfConsumerAddress,
	[BigInt('0x' + crypto.getRandomValues(new Uint32Array(8)).reduce((acc, n) => acc + n.toString(16).padStart(8, '0'), ''))]
);

gameFilter = dealer.filters.GameCreated();
gameEvents = await dealer.queryFilter(gameFilter);
gameId = gameEvents[gameEvents.length - 1].args[0];

await dealer.getGameState(gameId);

tx = await dealer.dealInitialCards(gameId);
receipt = await tx.wait();

cardFilter = dealer.filters.CardDealt();
cardEvents = await dealer.queryFilter(cardFilter);
playerCards = [
	(cardEvents[cardEvents.length - 3].args[1]),
	(cardEvents[cardEvents.length - 2].args[1])
];
dealerCards = [cardEvents[cardEvents.length - 1].args[1]];

playerCards.concat(dealerCards).map(getCardValue);

actionFilter = dealer.filters.PlayerAction();
actionEvents = await dealer.queryFilter(actionFilter);
action = actionEvents[actionEvents.length - 1].args[1];

cardRequestFilter = dealer.filters.CardRequested();
cardRequestEvents = await dealer.queryFilter(cardRequestFilter);
cardRequestId = cardRequestEvents[cardRequestEvents.length - 1].args[1];

tx = await dealer.hit(gameId);
receipt = await tx.wait();

tx = await dealer.dealHitCard(gameId);
receipt = await tx.wait();

tx = await dealer.doubleDown(gameId);
receipt = await tx.wait();

tx = await dealer.dealDoubleDownCard(gameId);
receipt = await tx.wait();

tx = await dealer.stand(gameId);
receipt = await tx.wait();

tx = await dealer.dealDealerCard(gameId);
receipt = await tx.wait();

randomEvents = await vrfConsumer.queryFilter(randomFilter);
requestId = randomEvents[randomEvents.length - 1].args[0]
await mockVRFCoordinator.fulfillRandomWordsWithOverride(
	requestId,
	vrfConsumerAddress,
	[BigInt('0x' + crypto.getRandomValues(new Uint32Array(8)).reduce((acc, n) => acc + n.toString(16).padStart(8, '0'), ''))]
);

cardEvents = await dealer.queryFilter(cardFilter);
playerCards.push(cardEvents[cardEvents.length - 1].args[1]);
dealerCards.push(cardEvents[cardEvents.length - 1].args[1]);
playerCards.concat(dealerCards).map(getCardValue);
await dealer.getGameState(gameId);
