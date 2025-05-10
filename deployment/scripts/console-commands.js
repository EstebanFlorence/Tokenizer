/*
	npx hardhat console --network <sepolia/localhost>
*/

/* Hardhat node */
// await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
// await ethers.provider.send("evm_mine");


async function getSigners() {
	/* Get signers */
	[deployer, owner2, owner3, user1] = await ethers.getSigners();
}


async function getContracts(isLocalhost) {
	/* Get Deployed Contract Instance */
	if (isLocalhost) {
		tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	} else {
		tokenizerAddress = "0xC1510A0839eCbA01a057b2D5447F8e64E88A2b35";
	}
	tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);
	
	vrfConsumerAddress = await tokenizer.vrfConsumer();
	vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);
	
	vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
	mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);
	
	if (isLocalhost) {
		treasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
	} else {
		treasuryAddress = "0xA7a0134a5aC5324621259062178652Fc0927530c";
	}
	treasury = await ethers.getContractAt("Treasury", treasuryAddress);
	
	if (isLocalhost) {
		dealerAddress = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
	} else {
		dealerAddress = "0x6d79ae1789eD18a276b7bAFb12Ecf5E2878bCDa6";
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
	
	/* Burn tokens (requires BURNER_ROLE) */
	await tokenizer.burn(user1.address, ethers.parseEther("50"));
	await treasury.proposeBurn(user1.address, burnAmount);
}


async function testMultisig() {
	/* Approve Multisig transactions */
	await treasury.approveTransaction(0);
	await treasury.connect(owner2).approveTransaction(0);
	// ...
	
	/* Execute Multisig transactions */
	await treasury.executeTransaction(0);
}


async function testRequest() {
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
}


async function testTrigger() {
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
	randomEvents = await vrfConsumer.queryFilter(randomFilter);
	requestId = randomEvents[randomEvents.length - 1].args[0]

	if (isLocalhost) {
		await getMockRandomness();
	}
}


async function approveDealer() {
	await tokenizer.approve(dealerAddress, ethers.parseEther("100000"));
	await tx.wait();
	console.log(allowance = ethers.formatEther(await tokenizer.allowance(deployer.getAddress(), dealer.getAddress())));
}

async function startGame(isLocalhost) {
	tx = await dealer.startGame(ethers.parseEther("1000"));
	receipt = await tx.wait();

	await getRandomness(isLocalhost);

	gameFilter = dealer.filters.GameCreated();
	gameEvents = await dealer.queryFilter(gameFilter);
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
	actionEvents = await dealer.queryFilter(actionFilter);
	action = actionEvents[actionEvents.length - 1].args[1];
}

async function getCardRequest() {
	cardRequestFilter = dealer.filters.CardRequested();
	cardRequestEvents = await dealer.queryFilter(cardRequestFilter);
	cardRequestId = cardRequestEvents[cardRequestEvents.length - 1].args[1];
}

async function getCardDealt(toPlayer, isStart) {
	cardDealtFilter = dealer.filters.CardDealt();
	cardDealtEvents = await dealer.queryFilter(cardDealtFilter);
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

async function dealDoubleDownCard() {
	tx = await dealer.dealDoubleDownCard(gameId);
	receipt = await tx.wait();
	await getCardDealt(true, false);
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
	await testRequest();
	await testTrigger();
	
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
	await dealDoubleDownCard();

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
	await testRequest();
	await testTrigger();

	/* Utils */
	await getArtifact();
	await sendEthToOwners();
	await getAction();
	await getCardRequest();
	await getBalances();
	isFulfilled = await vrfConsumer.isRandomnessFullfilled(requestId);

	/* Blackjack */
	await approveDealer();
	await startGame(false);
	await dealInitialCards();

	await hit(false);
	await dealHitCard();

	await doubleDown(false);
	await dealDoubleDownCard();

	await stand(false);

	await dealDealerCard();
	await getRandomness(false);
}
