import { expect } from 'chai';
import { ethers, waffle, network } from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import AggregatorV3Abi from '@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json';

describe('DayTraderV1', () => {
	const treasuryFee = 30;
	const betAmount = '0.1';
	let oracle: MockContract;
	let dayTrader: Contract;
	let owner: SignerWithAddress;
	let addresses: SignerWithAddress[];

	const placeBet = (bullish: boolean) => {
		return dayTrader.placeBet(bullish, { value: ethers.utils.parseEther(betAmount) });
	};

	before(async () => {
		[ owner, ...addresses ] = await ethers.getSigners();
	});

	beforeEach(async () => {
		await network.provider.send('hardhat_reset');

		const aggregatorV3 = await waffle.deployMockContract(addresses[3], AggregatorV3Abi);
		await aggregatorV3.deployed();

		await aggregatorV3.mock.latestRoundData.returns(0, 0, 0, 0, 0);
		await aggregatorV3.mock.getRoundData.returns(0, 0, 0, 0, 0);
		oracle = aggregatorV3;

		const DayTrader = await ethers.getContractFactory('DayTraderV1');
		dayTrader = await DayTrader.deploy(treasuryFee, oracle.address);
		await dayTrader.deployed();
	});

	context('Contract has no balance', () => {
		it('Should error if no balance', async () => {
			const message = 'No enough balance in betting pool.';
			let maxBettingAmount = await dayTrader.maxBettingAmount();
			console.log(maxBettingAmount.toString());
			await expect(placeBet(true)).be.revertedWith(message);
			maxBettingAmount = await dayTrader.maxBettingAmount();
			console.log(maxBettingAmount.toString());
		});
	});

	context('Contract has balance', () => {
		beforeEach(async () => {
			await owner.sendTransaction({ to: dayTrader.address, value: ethers.utils.parseEther('1') });
		});

		it('Should require value to place a bet', async () => {
			const message = 'Betting amount required.';
			await dayTrader.placeBet(true);
			await expect(placeBet(true)).be.revertedWith(message);
		});

		it('Should not be able to place more than one bet', async () => {
			const message = 'Bet already active.';
			await expect(placeBet(true)).be.not.revertedWith(message);
			await expect(placeBet(true)).be.revertedWith(message);
		});

		it('Should reserve amount after bet', async () => {
			let maxBettingAmount = await dayTrader.maxBettingAmount();
			console.log(maxBettingAmount.toString());
			expect(maxBettingAmount).be.equal(ethers.utils.parseEther('0.5'));
			await placeBet(true);
			maxBettingAmount = await dayTrader.maxBettingAmount();
			console.log(maxBettingAmount.toString());
			expect(maxBettingAmount).be.equal(ethers.utils.parseEther('0.5')); // should fail
		});

		it('Should be able to place a bet', async () => {
			let bet = await dayTrader.bets(owner.address);
			expect(bet.active).be.equal(false);
			await placeBet(true);
			bet = await dayTrader.bets(owner.address);
			expect(bet.active).be.equal(true);
		});

		it('Should not be able to claim reward', async () => {
			await placeBet(true);
			const message = 'Pausable: pause.';
			expect(dayTrader.claimReward(0)).be.revertedWith(message);
		});

		it('Should be able to be pause \'placeBet\'', async () => {
			const message = 'Pausable: pause';
			await expect(placeBet(true)).not.be.revertedWith(message);
			await dayTrader.pause();
			await expect(placeBet(true)).be.revertedWith(message);
		});
	});
});
