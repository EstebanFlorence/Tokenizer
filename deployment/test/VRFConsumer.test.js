const { ethers } = require("hardhat");
const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("VRFConsumer", function () {
	let vrfConsumer;
	let mockVRFCoordinator;
	let owner;
	let user1;
	const keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

	async function deployTokenizerFixture()
	{
		[owner, user1, user2] = await ethers.getSigners();

		// Deploy VRF Coordinator Mock
		const VRFCoordinatorV2_5Mock = await ethers.getContractFactory("VRFCoordinatorV2_5Mock");
		// Constructor params: baseFee and gasPriceLink
		mockVRFCoordinator = await VRFCoordinatorV2_5Mock.deploy(100000, 1e9, 6110300000000000);

		// Create VRF Subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();
		const subscriptionId = receipt.logs[0].args[0];

		// Deploy VRFConsumer
		const VRFConsumer = await ethers.getContractFactory("VRFConsumer");
		vrfConsumer = await VRFConsumer.deploy(
			await mockVRFCoordinator.getAddress(),
			subscriptionId,
			keyHash
		);

		// Fund the subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, await vrfConsumer.getAddress());

		return { vrfConsumer, mockVRFCoordinator, owner, user1, user2, subscriptionId };
	}

	describe("fulfillRandomWords", function () {
		it("Should request randomness and emit event", async function () {
			const { vrfConsumer, owner } = await loadFixture(deployTokenizerFixture);
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
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
				[44]
			);

			await expect(vrfConsumer.connect(user1).getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});

	describe("clearRandomRequest", function () {
		it("Should clear the request data", async function () {
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
				[777]
			);

			await vrfConsumer.clearRandomRequest(requestId);

			await expect(vrfConsumer.getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});
});