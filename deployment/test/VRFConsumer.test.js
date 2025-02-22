const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("VRFConsumer", function () {
	let vrfConsumer;
	let mockVRFCoordinator;
	let owner;
	let user1;
	const tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	const keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

	before(async function () {
		[owner, user1] = await ethers.getSigners();

		// Get contract instances
		tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);
		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);
		const vrfCoordinatorAddress = await vrfConsumer.coordinator();
		mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2Mock", vrfCoordinatorAddress);

		// Create VRF Subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();
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

	describe("requestRandomness", function () {
		it("Should request randomness and emit event", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				(log) => log.fragment && log.fragment.name === "RandomnessRequested"
			);
			const [requestId] = event.args;
			
			expect(event).to.not.be.undefined;
			expect(event.args.requestId).to.not.be.undefined;
			expect(event.args.requester).to.equal(owner.address);
		});
	});

	describe("fulfillRandomWords", function () {
		it("Should fulfill randomness and emit event", async function () {
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
				[42]
			);
			const randomness = await vrfConsumer.getRandomness(requestId);
			expect(randomness).to.equal(42);
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
				[42]
			);

			const randomness = await vrfConsumer.getRandomness(requestId);
			expect(randomness).to.equal(42);
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
				[42]
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
				[42]
			);

			await vrfConsumer.clearRandomRequest(requestId);

			await expect(vrfConsumer.getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});
});