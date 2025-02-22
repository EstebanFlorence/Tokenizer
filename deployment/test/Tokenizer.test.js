const { ethers } = require("hardhat");
const { expect } = require('chai');
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Tokenizer", function ()
{
	let tokenizer;
	let owner;
	let user1;
	let user2;
	let vrfConsumer;
	let mockVRFCoordinator;
	const keyHash = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
	const subscriptionId = 1234;
	const initialSupply = ethers.parseEther("1000000"); // 1 million tokens

	async function deployTokenizerFixture()
	{
		// Get signers
		[owner, user1, user2] = await ethers.getSigners();

		// Deploy VRF Coordinator Mock
		const VRFCoordinatorV2Mock = await ethers.getContractFactory("VRFCoordinatorV2Mock");
		// Constructor params: baseFee and gasPriceLink
		mockVRFCoordinator = await VRFCoordinatorV2Mock.deploy(100000, 1e9);

		// Create VRF Subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();
		const subscriptionId = receipt.logs[0].args[0];

		// Fund the subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));

		// Deploy VRFConsumer
		const VRFConsumer = await ethers.getContractFactory("VRFConsumer");
		vrfConsumer = await VRFConsumer.deploy(
			await mockVRFCoordinator.getAddress(),
			subscriptionId,
			keyHash
		);

		// Deploy Tokenizer
		const Tokenizer = await ethers.getContractFactory("Tokenizer");
		tokenizer = await Tokenizer.deploy(
			initialSupply,
			await vrfConsumer.getAddress()
		);

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, await tokenizer.vrfConsumer());

		return { tokenizer, mockVRFCoordinator, owner, user1, user2, subscriptionId };
	}

	describe("Deployment", function () {
		it("Should set the right owner", async function () {
			const { tokenizer, owner } = await loadFixture(deployTokenizerFixture);
			expect(await tokenizer.owner()).to.equal(owner.address);
		});

		it("Should assign the total supply to the owner", async function () {
			const { tokenizer, owner } = await loadFixture(deployTokenizerFixture);
			const ownerBalance = await tokenizer.balanceOf(owner.address);
			expect(await tokenizer.totalSupply()).to.equal(ownerBalance);
		});
	});

	describe("Minting", function () {
		it("Should allow owner to mint tokens", async function () {
			const { tokenizer, user1 } = await loadFixture(deployTokenizerFixture);
			const mintAmount = ethers.parseEther("100");
			await tokenizer.mint(user1.address, mintAmount);
			expect(await tokenizer.balanceOf(user1.address)).to.equal(mintAmount);
		});

		it("Should not allow non-owner to mint tokens", async function () {
			const { tokenizer, user1 } = await loadFixture(deployTokenizerFixture);
			const mintAmount = ethers.parseEther("100");
			await expect(
				tokenizer.connect(user1).mint(user1.address, mintAmount)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});
	});

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			const { tokenizer, owner } = await loadFixture(deployTokenizerFixture);

			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // +1 day
			await ethers.provider.send("evm_mine"); // Mine a new block
			await expect(tokenizer.triggerRandomEvent())
				.to.emit(tokenizer, "RandomEventTriggered")
				// .withArgs(expect.anyValue, owner.address);
		});

		it("Should not allow random event before interval", async function () {
			const { tokenizer } = await loadFixture(deployTokenizerFixture);

			await expect(tokenizer.triggerRandomEvent())
				.to.be.revertedWith("Too soon for a random event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			const { tokenizer, mockVRFCoordinator, owner } = await loadFixture(deployTokenizerFixture);
			
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
			const receipt = await tx.wait();
			
			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				log => log.fragment && log.fragment.name === 'RandomEventTriggered'
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);
			console.log("request ID: " + requestId);

			// Mock VRF response with even number (will trigger mint)
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
			const { tokenizer, mockVRFCoordinator, owner } = await loadFixture(deployTokenizerFixture);
			
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
			const receipt = await tx.wait();

			// Find the RandomEventTriggered event
			const event = receipt.logs.find(
				log => log.fragment && log.fragment.name === 'RandomEventTriggered'
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[1]
			);
			await tokenizer.handleRandomness(requestId);

			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			console.log("Initial Balance:", initialBalance.toString());
			console.log("Final Balance:\t", finalBalance.toString());
			expect(finalBalance).to.lessThan(initialBalance);
		});
	});
});
