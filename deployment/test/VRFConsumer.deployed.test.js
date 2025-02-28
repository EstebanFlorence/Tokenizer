const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("VRFConsumer (Using Deployed Contract)", function () {
	let vrfConsumer;
	let mockVRFCoordinator;
	let tokenizer;
	let owner;
	let user1;
	const tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

	before(async function () {
		[owner, user1] = await ethers.getSigners();

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

	describe("fulfillRandomWords", function () {
		it("Should request randomness and emit event", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomnessRequested"
			);
			const [requestId] = event.args;

			expect(event).to.not.be.undefined;
			expect(requestId).to.not.be.undefined;
			expect(event.args.requester).to.equal(owner.address);
		});
	});

	describe("getRandomness", function () {
		it("Should return the correct randomness for the requester", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomnessRequested"
			);
			const [requestId] = event.args;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			const randomness = await vrfConsumer.getRandomness(requestId);
			expect(randomness).to.equal(23);
		});

		it("Should revert if called by non-requester", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomnessRequested"
			);
			const [requestId] = event.args;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			await expect(vrfConsumer.connect(user1).getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});

	describe("clearRandomRequest", function () {
		it("Should clear the request data", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomnessRequested"
			);
			const [requestId] = event.args;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			await vrfConsumer.clearRandomRequest(requestId);

			await expect(vrfConsumer.getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});
});