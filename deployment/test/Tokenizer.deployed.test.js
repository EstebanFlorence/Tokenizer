const { ethers } = require("hardhat");
const { expect } = require('chai');

describe("Tokenizer (Using Deployed Contract)", function () {
	let tokenizer;
	let owner;
	let user1;
	let user2;
	let vrfConsumer;
	let mockVRFCoordinator;
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
		console.log(receipt);
		const subscriptionId = receipt.logs[0].args[0];
		console.log(subscriptionId);

		// Fund the subscription if needed
		try {
			await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
			console.log("Funded VRF subscription");
		} catch (error) {
			console.log("Subscription might already be funded:", error.message);
		}

		// Add consumer if needed
		try {
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			console.log("Added consumer to VRF subscription");
		} catch (error) {
			console.log("Consumer might already be registered:", error.message);
		}
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await tokenizer.owner()).to.equal(owner.address);
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
			).to.be.revertedWith("Ownable: caller is not the owner");
		});
	});

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			await expect(tokenizer.triggerRandomEvent()).to.emit(tokenizer, "RandomEventTriggered");
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
			// Trigger event
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

			// Mock VRF response (odd number → burn)
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
