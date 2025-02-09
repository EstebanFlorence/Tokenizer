const { ethers } = require("hardhat");
const { expect } = require('chai');

describe("Tokenizer (Using Deployed Contract)", function () {
	let tokenizer;
	let owner;
	let user1;
	let user2;
	let mockVRFCoordinator;
	const tokenizerAddress = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

	before(async function () {
		[owner, user1, user2] = await ethers.getSigners();

		// Get contract instances
		tokenizer = await ethers.getContractAt("Tokenizer", tokenizerAddress);
		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		console.log(vrfConsumerAddress);
		vrfConsumer = await ethers.getContractAt("VRFConsumer", vrfConsumerAddress);
		const vrfCoordinatorAddress = await vrfConsumer.coordinator();
		console.log(vrfCoordinatorAddress);
		mockVRFCoordinator = await ethers.getContractAt("VRFCoordinatorV2Mock", vrfCoordinatorAddress);
	});

	it("Should connect to deployed contract", async function () {
		expect(await tokenizer.owner()).to.equal(owner.address);
	});

	it("Should trigger random event", async function () {
		await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
		await ethers.provider.send("evm_mine");
		await expect(tokenizer.triggerRandomEvent()).to.emit(tokenizer, "RandomEventTriggered");
	});

	it("Should not allow random event before interval", async function () {
		await expect(tokenizer.triggerRandomEvent()).to.be.revertedWith("Too soon for a random event");
	});

	it("Should process random words and mint tokens", async function () {
		// Trigger event
		await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
		await ethers.provider.send("evm_mine");
		const tx = await tokenizer.triggerRandomEvent();
		const receipt = await tx.wait();
		const event = receipt.logs.find(
			(log) => log.fragment && log.fragment.name === "RandomEventTriggered"
		);
		const [requestId] = event.args;

		const initialBalance = await tokenizer.balanceOf(owner.address);

		// Mock VRF response (even number → mint)
		await mockVRFCoordinator.fulfillRandomWordsWithOverride(requestId, vrfConsumer.target, [2]);
		await tokenizer.handleRandomness(requestId);

		const finalBalance = await tokenizer.balanceOf(owner.address);
		console.log("Initial Balance:", initialBalance.toString());
		console.log("Final Balance:\t", finalBalance.toString());
		expect(finalBalance).to.be.greaterThan(initialBalance);
	});

	it("Should process random words and burn tokens", async function () {
		// Trigger event
		await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
		await ethers.provider.send("evm_mine");
		const tx = await tokenizer.triggerRandomEvent();
		const receipt = await tx.wait();
		const event = receipt.logs.find(
			(log) => log.fragment && log.fragment.name === "RandomEventTriggered"
		);
		const [requestId] = event.args;

		const initialBalance = await tokenizer.balanceOf(owner.address);

		// Mock VRF response (even number → mint)
		await mockVRFCoordinator.fulfillRandomWordsWithOverride(requestId, vrfConsumer.target, [1]);
		await tokenizer.handleRandomness(requestId);

		const finalBalance = await tokenizer.balanceOf(owner.address);
		console.log("Initial Balance:", initialBalance.toString());
		console.log("Final Balance:\t", finalBalance.toString());
		expect(finalBalance).to.be.lessThan(initialBalance);
	});

});
