// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DayTraderV1 is Ownable, Pausable {
    struct Bet {
        bool active;
        bool bullish;
        bool readyToClaim;
        uint80 startRoundId;
        uint startTimestamp;
        uint amount;
    }

    uint public constant BET_WINDOW = 1 days;
    uint public constant MAX_TREASURY_FEE = 100; // 10%

    mapping(address => Bet) public bets;
    address[] public activePlayers;
    uint public reservedBalance;

    uint public treasuryBalance;
    uint public treasuryFee;

    AggregatorV3Interface private oracle;

    event PlacedBet(address indexed sender, uint amount, bool bullish);
    event ClaimedReward(address indexed sender, uint amount);
    event ClosedActiveBets(uint beforeLength, uint afterLength);
    event Received(address sender, uint amount);

    constructor(uint _treasuryFee, address oracleAddress) {
        treasuryFee = _treasuryFee;
        oracle = AggregatorV3Interface(oracleAddress);
    }

    function placeBet(bool bullish) external payable whenNotPaused {
        uint maxAmount = maxBetAmount(msg.value);
        require(maxAmount > 0, "No enough balance in betting pool.");
        require(msg.value > 0, "Betting amount required.");
        require(msg.value <= maxAmount, "Betting amount too big, disallowed.");

        Bet storage bet = bets[msg.sender];
        require(!bet.active, "Bet already active.");
        (uint80 roundId , , , , ) = oracle.latestRoundData();

        bet.startRoundId = roundId;
        bet.active = true;
        bet.bullish = bullish;
        bet.amount = msg.value;
        bet.startTimestamp = block.timestamp;

        reservedBalance += msg.value * 2;

        activePlayers.push(msg.sender);
        emit PlacedBet(msg.sender, msg.value, bullish);
    }

    function claimReward(uint80[] calldata endRoundIds) external {
        Bet storage bet = bets[msg.sender];

        closeActiveBets(endRoundIds);
        require(bet.active, "No active bet found, or lost bet.");
        require(bet.readyToClaim, "Bet ongoing, nothing to claim.");

        uint reward = bet.amount * 2;
        uint fees = (reward * treasuryFee) / 1000;
        treasuryBalance += fees;

        reservedBalance -= bet.amount * 2;
        payable(msg.sender).transfer(reward - fees);
        bet.active = false;
        emit ClaimedReward(msg.sender, bet.amount);
    }

    function getEndRoundId(address player) external view returns(uint80) {
        Bet storage bet = bets[player];
        require(bet.active, "No active bet found.");

        uint dueTimestamp = bet.startTimestamp + BET_WINDOW;
        require(block.timestamp >= dueTimestamp, "Bet not due yet.");

        uint80 roundId = bet.startRoundId;
        uint oracleTimestamp = bet.startTimestamp;
        while (oracleTimestamp < dueTimestamp) {
            roundId += 1;
            (, , , oracleTimestamp, ) = oracle.getRoundData(roundId);
            require(oracleTimestamp > 0, "Not price data yet, try later.");
        }

        return roundId;
    }

    function playersEndRoundIds() external view returns(uint80[] memory) {
        uint80[] memory endRoundIds = new uint80[](activePlayers.length);
        for (uint i = 0; i < activePlayers.length; i++) {
            try this.getEndRoundId(activePlayers[i]) returns (uint80 endRound) {
                endRoundIds[i] = endRound;
            } catch {
                continue;
            }
        }
        return endRoundIds;
    }

    function betResult(address player, uint80 endRoundId) public view returns(bool) {
        Bet storage bet = bets[player];
        require(bet.active, "No bet placed yet.");

        uint dueTimestamp = bet.startTimestamp + BET_WINDOW;
        (, int startPrice, , , ) = oracle.getRoundData(bet.startRoundId);
        (, int endPrice, , uint endTimestamp, ) = oracle.getRoundData(endRoundId);
        (, , , uint preEndTimestamp, ) = oracle.getRoundData(endRoundId - 1);
        require(endTimestamp >= dueTimestamp && preEndTimestamp < dueTimestamp, "Invalid endRoundId.");

        return (endPrice >= startPrice) == bet.bullish;
    }

    function betResult(address player) external view returns(bool) {
        return betResult(player, this.getEndRoundId(player));
    }

    function closeActiveBets(uint80[] calldata endRoundIds) public {
        for (uint i = 0; i < activePlayers.length; i++) {
            if (endRoundIds[i] == 0) continue;

            bool result = betResult(activePlayers[i], endRoundIds[i]);
            Bet storage bet = bets[activePlayers[i]];
            bet.active = result;
            bet.readyToClaim = result;
            if (!result) reservedBalance -= bet.amount * 2;

            delete activePlayers[i];
        }

        for (uint i = 0; i < activePlayers.length; i++) {
            while (activePlayers.length > 0 && activePlayers[i] == address(0)) {
                activePlayers[i] = activePlayers[activePlayers.length - 1];
                activePlayers.pop();
            }
        }
        emit ClosedActiveBets(endRoundIds.length, activePlayers.length);
    }

    function maxBetAmount() external view returns(uint) {
        uint availableBalance = address(this).balance - reservedBalance - treasuryBalance;
        return availableBalance >> 1;
    }

    function maxBetAmount(uint betAmount) internal view returns(uint) {
        uint availableBalance = address(this).balance - betAmount - reservedBalance - treasuryBalance;
        if (availableBalance <= 0) return 0;
        return availableBalance >> 1;
    }

    function updateTreasuryFee(uint _treasuryFee) external onlyOwner {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high.");
        treasuryFee = _treasuryFee;
    }

    function claimTreasury() external onlyOwner {
        require(treasuryBalance > 0, "No treasury to claim.");
        payable(owner()).transfer(treasuryBalance);
        treasuryBalance = 0;
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
}
