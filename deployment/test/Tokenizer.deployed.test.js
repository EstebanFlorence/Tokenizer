const { ethers } = require("hardhat");
const { expect } = require('chai');

describe("Tokenizer (Using Deployed Contract)", function () {
	let vrfConsumer;
	let mockVRFCoordinator;
	let tokenizer;
	let biscaTreasury;
	let owner, owner2, owner3, user1;

	const tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	const biscaTreasuryAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

	before(async function () {

		[owner, owner2, owner3, user1] = await ethers.getSigners();

		// Get contract instances
		tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);

		const vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
		mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);

		biscaTreasury = await ethers.getContractAt("BiscaTreasury", biscaTreasuryAddress);

		// Create VRF Subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();
		const subscriptionId = receipt.logs[0].args[0];

		// Fund the subscription
		try {
			await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
			console.log("Funded VRF subscription");
		} catch (error) {
			console.log("Subscription might already be funded:", error.message);
		}

		// Add consumer to VRF
		try {
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			console.log("Added consumer to VRF subscription");
		} catch (error) {
			console.log("Consumer might already be registered:", error.message);
		}
	});

	describe("BiscaTreasury", function () {
		it("Should allow BiscaTreasury to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance + mintAmount;

			// Propose mint transaction
			const proposeTx = await biscaTreasury.proposeMint(owner2.address, mintAmount);
			const proposeReceipt = await proposeTx.wait();

			// Fetch the transaction ID from the emitted event
			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			// Execute mint transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should allow BiscaTreasury to burn tokens", async function () {
			const burnAmount = ethers.parseEther("50");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance - burnAmount;

			// Propose burn transaction
			const proposeTx = await biscaTreasury.proposeBurn(owner2.address, burnAmount);
			const proposeReceipt = await proposeTx.wait();

			// Fetch the transaction ID from the emitted event
			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			// Execute burn transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should not allow unauthorized accounts to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeMint(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should not allow unauthorized accounts to burn tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeBurn(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await tokenizer.hasRole(await tokenizer.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
		});
	});

	describe("Pausing", function () {
		it("Should allow owner to pause and unpause the contract", async function () {
			await tokenizer.connect(owner).pause();
			expect(await tokenizer.paused()).to.be.true;
			await tokenizer.connect(owner).unpause();
			expect(await tokenizer.paused()).to.be.false;
		});

		it("Should not allow non-owner to pause or unpause the contract", async function () {
			await expect(tokenizer.connect(owner2).pause()).to.be.revertedWith(`AccessControl: account ${owner2.address.toLowerCase()} is missing role ${await tokenizer.PAUSER_ROLE()}`);
			await expect(tokenizer.connect(owner2).unpause()).to.be.revertedWith(`AccessControl: account ${owner2.address.toLowerCase()} is missing role ${await tokenizer.PAUSER_ROLE()}`);
		});

		it("Should not allow minting when paused", async function () {
			const mintAmount = ethers.parseEther("100");
			await tokenizer.pause();
			await tokenizer.grantRole(await tokenizer.MINTER_ROLE(), owner.address);
			await expect(tokenizer.mint(owner2.address, mintAmount)).to.be.revertedWith("Pausable: paused");
			await tokenizer.unpause();
		});

		it("Should allow minting when unpaused", async function () {
			await tokenizer.pause();
			await tokenizer.unpause();
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			await tokenizer.mint(owner2.address, mintAmount);
			const expectedBalance = initialBalance + mintAmount;
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});
	});

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			await expect(tokenizer.connect(owner).triggerRandomEvent())
				.to.emit(tokenizer, "RandomEventTriggered");
		});

		it("Should not allow random event before interval", async function () {
			await expect(tokenizer.connect(owner).triggerRandomEvent()).to.be.revertedWith("Too soon for a random event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.connect(owner).triggerRandomEvent();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomEventTriggered"
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);
			console.log("request ID: " + requestId);

			// Mock VRF response (even number → mint)
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[2]
			);
			await tokenizer.connect(owner).handleRandomness(requestId);

			// Verify balance increased
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.be.greaterThan(initialBalance);
		});

		it("Should process random words and burn tokens on odd number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.connect(owner).triggerRandomEvent();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomEventTriggered"
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(requestId, vrfConsumer.target, [1]);
			await tokenizer.connect(owner).handleRandomness(requestId);

			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.be.lessThan(initialBalance);
		});
	});
});
