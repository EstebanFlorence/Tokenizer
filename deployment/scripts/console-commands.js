/*
	npx hardhat console --network <sepolia/localhost>
*/

/* Hardhat node */
// await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
// await ethers.provider.send("evm_mine");

async function updateBlocks() {
	// Get the current block number
	latestBlock = await ethers.provider.getBlockNumber();
	// Query only the last 500 blocks
	fromBlock = Math.max(0, latestBlock - 499);
}


async function getSigners() {
	/* Get signers */
	[deployer, owner2, owner3, user1] = await ethers.getSigners();
	return(deployer, owner2, owner3, user1);
}

async function getContracts(isLocalhost) {
	/* Get Deployed Contract Instance */
	if (isLocalhost) {
		tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	} else {
		tokenizerAddress = "0x79fa86D2F598AF9473e120B3c3441458417A05D8";
	}
	tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);
	
	vrfConsumerAddress = await tokenizer.vrfConsumer();
	vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);
	
	vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
	mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);
	
	if (isLocalhost) {
		treasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
	} else {
		treasuryAddress = "0x6E098f1490a68a55D3f32e22a826dF9CB5fAd1c4";
	}
	treasury = await ethers.getContractAt("Treasury", treasuryAddress);
	
	if (isLocalhost) {
		dealerAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
	} else {
		dealerAddress = "0x021F426B093B7343FBEAc6DDccf7f1F043bd6379";
	}
	dealer = await ethers.getContractAt("Dealer", dealerAddress);

	await getBalances();
}

async function getBalances() {
	/* Balance */
	console.log("Deployer ETH:\t\t" , ethers.formatEther(await ethers.provider.getBalance(deployer.address)));
	console.log("Deployer Tokens:\t" , ethers.formatEther(await tokenizer.balanceOf(deployer.address)));
	console.log("Dealer Tokens:\t\t" , ethers.formatEther(await tokenizer.balanceOf(dealerAddress)));
	console.log("Treasury Tokens:\t" , ethers.formatEther(await tokenizer.balanceOf(treasuryAddress)));

	/* Check the total supply of tokens */
	console.log("Tokens Total Supply:\t" , ethers.formatEther(await tokenizer.totalSupply()));
}

async function testRoles() {
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

	/* Revoke role */
	await tokenizer.revokeRole((await tokenizer.DEFAULT_ADMIN_ROLE()), deployer.address);
	await tokenizer.revokeRole((await tokenizer.MINTER_ROLE()), deployer.address);
	await tokenizer.revokeRole((await tokenizer.BURNER_ROLE()), deployer.address);
	await tokenizer.revokeRole((await tokenizer.PAUSER_ROLE()), deployer.address);
}

async function testPause() {
	/* Pause the contract (requires PAUSER_ROLE) */
	await tokenizer.pause();
	
	/* Unpause the contract (requires PAUSER_ROLE) */
	await tokenizer.unpause();

	/* Mint tokens (requires MINTER_ROLE) */
	await tokenizer.mint(user1.address, ethers.parseEther("100"));
	await treasury.proposeMint(dealerAddress, ethers.parseEther("42000"));
	await getProposalId();

	/* Burn tokens (requires BURNER_ROLE) */
	await tokenizer.burn(user1.address, ethers.parseEther("50"));
	await treasury.proposeBurn(user1.address, burnAmount);
	await getProposalId();
}

async function getProposalId() {
	// Get the transaction submission events
	filter = treasury.filters.TransactionSubmitted();
	await updateBlocks();
	events = await treasury.queryFilter(filter, fromBlock, latestBlock);
	proposalId = events[events.length - 1].args[0];
	return proposalId;
}

async function testMultisig() {
	/* Approve Multisig transactions */
	await treasury.approveTransaction(proposalId);
	await treasury.connect(owner2).approveTransaction(proposalId);
	// ...
	
	/* Execute Multisig transactions */
	await treasury.executeTransaction(proposalId);
}

async function testRequest(isLocalhost) {
	tx = await vrfConsumer.requestRandomness();
	receipt = await tx.wait();
	filter = vrfConsumer.filters.RandomnessRequested();
	await updateBlocks();
	events = await vrfConsumer.queryFilter(filter, fromBlock, latestBlock);
	requestId = events[events.length - 1].args[0]
	if (isLocalhost) {
		await getMockRandomness();
	}
	return(randomness = await vrfConsumer.getRandomness(requestId));
}

async function testTrigger(isLocalhost) {
	tx = await treasury.triggerRandomEvent();
	receipt = await tx.wait();
	filter = treasury.filters.RandomEventTriggered();
	await updateBlocks();
	events = await treasury.queryFilter(filter, fromBlock, latestBlock);
	requestId = events[events.length - 1].args.requestId;
	if (isLocalhost) {
		await getMockRandomness();
	}
	await treasury.handleRandomness(requestId);
}

async function sendEthToOwners() {
	/* Send ETH */
	await deployer.sendTransaction({
		to: owner2.address,
		value: ethers.parseEther("0.1")
	});
	
	await deployer.sendTransaction({
		to: owner3.address,
		value: ethers.parseEther("0.1")
	});

}

async function getArtifact() {
	/* Get contract interface */
	dealerArtifact = JSON.parse(fs.readFileSync("artifacts/contracts/Dealer.sol/Dealer.json", 'utf8'));
	iface = new ethers.Interface(dealerArtifact.abi);
}


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

async function getMockRandomness() {
	await mockVRFCoordinator.fulfillRandomWordsWithOverride(
		requestId,
		vrfConsumerAddress,
		[BigInt('0x' + crypto.getRandomValues(new Uint32Array(8)).reduce((acc, n) => acc + n.toString(16).padStart(8, '0'), ''))]
	);
}

async function getRandomness(isLocalhost) {
	randomFilter = vrfConsumer.filters.RandomnessRequested();
	await updateBlocks();
	randomEvents = await vrfConsumer.queryFilter(randomFilter, fromBlock, latestBlock);
	requestId = await randomEvents[randomEvents.length - 1].args[0]

	if (isLocalhost) {
		await getMockRandomness();
	}
}


async function approveDealer() {
	tx = await tokenizer.approve(dealerAddress, ethers.parseEther("100000"));
	receipt = await tx.wait();
	allowance = ethers.formatEther(await tokenizer.allowance(deployer.getAddress(), dealer.getAddress()));
	return allowance;
}

async function startGame(isLocalhost) {
	tx = await dealer.startGame(ethers.parseEther("1000"));
	receipt = await tx.wait();

	await getRandomness(isLocalhost);

	gameFilter = dealer.filters.GameCreated();
	await updateBlocks();
	gameEvents = await dealer.queryFilter(gameFilter, fromBlock, latestBlock);
	gameId = gameEvents[gameEvents.length - 1].args[0];

	console.log("Game ID: ", gameId);
	console.log(await dealer.getGameState(gameId));
}

async function dealInitialCards() {
	tx = await dealer.dealInitialCards(gameId);
	receipt = await tx.wait();

	await getCardDealt(false, true);
}


async function getAction() {
	actionFilter = dealer.filters.PlayerAction();
	await updateBlocks();
	actionEvents = await dealer.queryFilter(actionFilter, fromBlock, latestBlock);
	action = actionEvents[actionEvents.length - 1].args[1];
}

async function getCardRequest() {
	cardRequestFilter = dealer.filters.CardRequested();
	await updateBlocks();
	cardRequestEvents = await dealer.queryFilter(cardRequestFilter, fromBlock, latestBlock);
	cardRequestId = cardRequestEvents[cardRequestEvents.length - 1].args[1];
}

async function getCardDealt(toPlayer, isStart) {
	cardDealtFilter = dealer.filters.CardDealt();
	await updateBlocks();
	cardDealtEvents = await dealer.queryFilter(cardDealtFilter, fromBlock, latestBlock);
	if (isStart) {
		playerCards = [
			(cardDealtEvents[cardDealtEvents.length - 3].args[1]),
			(cardDealtEvents[cardDealtEvents.length - 2].args[1])
		];
		dealerCards = [cardDealtEvents[cardDealtEvents.length - 1].args[1]];
	} else if (toPlayer) {
		playerCards.push(cardDealtEvents[cardDealtEvents.length - 1].args[1]);
	} else {
		dealerCards.push(cardDealtEvents[cardDealtEvents.length - 1].args[1]);
	}

	console.log(playerCards.concat(dealerCards).map(getCardValue));
	console.log(await dealer.getGameState(gameId));
}


async function hit(isLocalhost) {
	tx = await dealer.hit(gameId);
	receipt = await tx.wait();
	await getRandomness(isLocalhost);
}

async function dealHitCard() {
	tx = await dealer.dealHitCard(gameId);
	receipt = await tx.wait();
	await getCardDealt(true, false);
}

async function doubleDown(isLocalhost) {
	tx = await dealer.doubleDown(gameId);
	receipt = await tx.wait();
	await getRandomness(isLocalhost);
}

async function dealDoubleDownCard(isLocalhost) {
	tx = await dealer.dealDoubleDownCard(gameId);
	receipt = await tx.wait();
	await getCardDealt(true, false);
	await getRandomness(isLocalhost);
}

async function stand(isLocalhost) {
	tx = await dealer.stand(gameId);
	receipt = await tx.wait();
	await getRandomness(isLocalhost);
}

async function dealDealerCard() {
	tx = await dealer.dealDealerCard(gameId);
	receipt = await tx.wait();
	await getCardDealt(false, false);
}


async function playLocal() {
	/* Start */
	await getSigners();
	await getContracts(true);
	/* Test */
	await testRoles();
	await testPause();
	await testMultisig();
	await testRequest(true);
	await testTrigger(true);
	
	/* Utils */
	await getArtifact();
	await sendEthToOwners();
	await getAction();
	await getCardRequest();
	await getBalances();

	/* Blackjack */
	await approveDealer();
	await startGame(true);
	await dealInitialCards();

	await hit(true);
	await dealHitCard();

	await doubleDown(true);
	await dealDoubleDownCard(true);

	await stand(true);

	await dealDealerCard();
	await getRandomness(true);
}

async function playSepolia() {
	/* Start */
	await getSigners();
	await getContracts(false);
	/* Test */
	await testRoles();
	await testPause();
	await testMultisig();
	await testRequest(false);
	await testTrigger(false);

	/* Utils */
	await getArtifact();
	await sendEthToOwners();
	await getAction();
	await getCardRequest();
	await getBalances();
	await vrfConsumer.isRandomnessFullfilled(requestId);

	/* Blackjack */
	await approveDealer();
	await startGame(false);
	await dealInitialCards();

	await hit(false);
	await dealHitCard();

	await doubleDown(false);
	await dealDoubleDownCard(false);

	await stand(false);

	await dealDealerCard();
	await getRandomness(false);
}
