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

	describe('#placeBet', () => {
		context('Contract has no balance', () => {
			it('Should error if no balance', async () => {
				const message = 'No enough balance in betting pool.';
				const maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal('0');
				await expect(placeBet(true)).be.revertedWith(message);
			});
		});

		context('Contract has balance', () => {
			beforeEach(async () => {
				await owner.sendTransaction({ to: dayTrader.address, value: ethers.utils.parseEther('1') });
			});

			it('Should require value to place a bet', async () => {
				const message = 'Betting amount required.';
				await expect(dayTrader.placeBet(true)).be.revertedWith(message);
			});

			it('Should not be able to place more than one bet', async () => {
				const message = 'Bet already active.';
				await expect(placeBet(true)).be.not.revertedWith(message);
				await expect(placeBet(true)).be.revertedWith(message);
			});

			it('Should not be able to bet more than available amount', async () => {
				const tx = dayTrader.placeBet(true, { value: ethers.utils.parseEther('0.500001') });
				const message = 'Betting amount too big, disallowed.';
				await expect(tx).be.revertedWith(message);
			});

			it('Should reserve amount after bet', async () => {
				let maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal(ethers.utils.parseEther('0.5'));
				await placeBet(true);
				maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal(ethers.utils.parseEther('0.45'));
				const reservedAmount = await dayTrader.reservedBalance();
				expect(reservedAmount).be.equal(ethers.utils.parseEther('0.2'));
			});

			it('Should be able to place a bet', async () => {
				let bet = await dayTrader.bets(owner.address);
				expect(bet.active).be.equal(false);
				await placeBet(true);
				bet = await dayTrader.bets(owner.address);
				expect(bet.active).be.equal(true);
			});

			it('Should be able to be pause \'placeBet\'', async () => {
				const message = 'Pausable: pause';
				await expect(placeBet(true)).not.be.revertedWith(message);
				await dayTrader.pause();
				await expect(placeBet(true)).be.revertedWith(message);
			});
		});
	});

	describe('#claimReward', () => {
		beforeEach(async () => {
			await owner.sendTransaction({ to: dayTrader.address, value: ethers.utils.parseEther('1') });
		});

		it('Should not be able to claim reward right away', async () => {
			// await placeBet(true);
			// const message = '';
			// await expect(dayTrader.claimReward(0)).be.revertedWith(message);
		});
	});
});
