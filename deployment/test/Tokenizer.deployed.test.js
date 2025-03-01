const { ethers } = require("hardhat");
const { expect } = require('chai');

describe("Tokenizer (Using Deployed Contract)", function () {
	let vrfConsumer;
	let mockVRFCoordinator;
	let tokenizer;
	let owner;
	let user1;
	let user2;
	const tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

	before(async function () {

		[owner, user1, user2] = await ethers.getSigners();

		// Get contract instances
		tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);

		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);

		const vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
		mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2_5Mock", vrfCoordinatorAddress);

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

		// Add consumer
		try {
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			console.log("Added consumer to VRF subscription");
		} catch (error) {
			console.log("Consumer might already be registered:", error.message);
		}
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await tokenizer.hasRole(await tokenizer.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
		});
	});

	describe("Minting", function () {
		it("Should allow owner to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(user1.address);
			await tokenizer.mint(user1.address, mintAmount);
			const expectedBalance = initialBalance + mintAmount;
			expect(await tokenizer.balanceOf(user1.address)).to.equal(expectedBalance);
		});
		it("Should not allow non-owner to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");
			await expect(
				tokenizer.connect(user1).mint(user1.address, mintAmount)
				).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${await tokenizer.MINTER_ROLE()}`);
		});
	});

	describe("Pausing", function () {
		it("Should allow owner to pause and unpause the contract", async function () {
			await tokenizer.pause();
			expect(await tokenizer.paused()).to.be.true;
			await tokenizer.unpause();
			expect(await tokenizer.paused()).to.be.false;
		});

		it("Should not allow non-owner to pause or unpause the contract", async function () {
			await expect(tokenizer.connect(user1).pause()).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${await tokenizer.PAUSER_ROLE()}`);
			await expect(tokenizer.connect(user1).unpause()).to.be.revertedWith(`AccessControl: account ${user1.address.toLowerCase()} is missing role ${await tokenizer.PAUSER_ROLE()}`);
		});

		it("Should not allow minting when paused", async function () {
			const mintAmount = ethers.parseEther("100");
			await tokenizer.pause();
			await expect(tokenizer.mint(user1.address, mintAmount)).to.be.revertedWith("Pausable: paused");
			await tokenizer.unpause();
		});

		it("Should allow minting when unpaused", async function () {
			await tokenizer.pause();
			await tokenizer.unpause();
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(user1.address);
			await tokenizer.mint(user1.address, mintAmount);
			const expectedBalance = initialBalance + mintAmount;
			expect(await tokenizer.balanceOf(user1.address)).to.equal(expectedBalance);
		});
	});

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			await expect(tokenizer.triggerRandomEvent())
				.to.emit(tokenizer, "RandomEventTriggered");
		});

		it("Should not allow random event before interval", async function () {
			await expect(tokenizer.triggerRandomEvent()).to.be.revertedWith("Too soon for a random event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
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
			await tokenizer.handleRandomness(requestId);

			// Verify balance increased
			const finalBalance = await tokenizer.balanceOf(owner.address);
			console.log("Initial Balance:", initialBalance.toString());
			console.log("Final Balance:\t", finalBalance.toString());
			expect(finalBalance).to.be.greaterThan(initialBalance);
		});

		it("Should process random words and burn tokens on odd number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
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
			await tokenizer.handleRandomness(requestId);

			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			console.log("Initial Balance:", initialBalance.toString());
			console.log("Final Balance:\t", finalBalance.toString());
			expect(finalBalance).to.be.lessThan(initialBalance);
		});
	});
});
