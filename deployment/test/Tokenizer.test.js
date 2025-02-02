const { ethers } = require("hardhat");
const { expect } = require('chai');
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Tokenizer", function ()
{
	let tokenizer;
	let owner;
	let user1;
	let user2;
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

		// Deploy Tokenizer
		const Tokenizer = await ethers.getContractFactory("Tokenizer");
		tokenizer = await Tokenizer.deploy(
			initialSupply,
			subscriptionId,
			await mockVRFCoordinator.getAddress(),
			keyHash
		);

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, await tokenizer.getAddress());

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

	describe("Quantum Events", function () {
		it("Should trigger quantum event", async function () {
			const { tokenizer, owner } = await loadFixture(deployTokenizerFixture);
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // +1 day
			await ethers.provider.send("evm_mine"); // Mine a new block
			await expect(tokenizer.triggerQuantumEvent())
				.to.emit(tokenizer, "QuantumEventTriggered")
				// .withArgs(expect.anyValue, owner.address);
		});

		it("Should not allow quantum event before interval", async function () {
			const { tokenizer } = await loadFixture(deployTokenizerFixture);
			// await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			// await ethers.provider.send("evm_mine");
			// await tokenizer.triggerQuantumEvent();
			await expect(tokenizer.triggerQuantumEvent())
				.to.be.revertedWith("too soon for a quantum event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			const { tokenizer, mockVRFCoordinator, owner } = await loadFixture(deployTokenizerFixture);
			
			// Trigger quantum event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerQuantumEvent();
			const receipt = await tx.wait();
			
			// Find the QuantumEventTriggered event
			const event = receipt.logs.find(
				log => log.fragment && log.fragment.name === 'QuantumEventTriggered'
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response with even number (will trigger mint)
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await tokenizer.getAddress(),
				[2]
			);

			// Verify balance increased
			const finalBalance = await tokenizer.balanceOf(owner.address);
			console.log("Initial Balance:", initialBalance.toString());
			console.log("Final Balance:", finalBalance.toString());			
			expect(finalBalance).to.be.greaterThan(initialBalance);
		});

		it("Should process random words and burn tokens on odd number", async function () {
			const { tokenizer, mockVRFCoordinator, owner } = await loadFixture(deployTokenizerFixture);
			
			// Give mock ability to return specific numbers (if supported)
			// Note: You might need to modify this based on the specific VRFCoordinatorV2Mock implementation
			
			// Trigger quantum event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerQuantumEvent();
			const receipt = await tx.wait();
			const event = receipt.logs.find(
				log => log.fragment && log.fragment.name === 'QuantumEventTriggered'
			);
			const [requestId] = event.args;

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await tokenizer.getAddress(),
				[1]
			);
			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			console.log("Initial Balance:", initialBalance.toString());
			console.log("Final Balance:", finalBalance.toString());
			expect(finalBalance).to.lessThan(initialBalance);
		});
	});
});

/* 
describe("Tokenizer", function () {
	let Tokenizer, tokenizer, owner, addr1, addr2;

	beforeEach(async function () {

		// Set up ethers contract, representing deployed Tokenizer instance
		Tokenizer = await ethers.getContractFactory("Tokenizer");

		// Retrieve accounts from the local node
		[owner, addr1, addr2, _] = await ethers.getSigners();
		
		tokenizer = await Tokenizer.deploy(ethers.parseUnits('1000', 18));
		// await tokenizer.deployed();
	});

	it("Should assign the initial supply to the owner", async function () {
		const ownerBalance = await tokenizer.balanceOf(owner.address);
		expect(await tokenizer.totalSupply()).to.equal(ownerBalance);
	});

	it("Should allow the owner to mint tokens", async function () {
		await tokenizer.mint(addr1.address, ethers.parseUnits('500', 18));
		const addr1Balance = await tokenizer.balanceOf(addr1.address);
		expect(addr1Balance).to.equal(ethers.parseUnits('500', 18));
	});

	it("Should not allow non-owners to mint tokens", async function () {
		await expect(
			tokenizer.connect(addr1).mint(addr2.address, ethers.parseUnits('500', 18))
		).to.be.reverted//With("Ownable: caller is not the owner");
	});

})
 */