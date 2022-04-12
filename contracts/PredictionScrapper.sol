// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import "./PancakePredictionV2.sol";

contract PredictionScrapper {
    PancakePredictionV2 public predicter = PancakePredictionV2(0x18B2A687610328590Bc8F2e5fEdDe3b582A49cdA);

    function scrap() public view returns (bool) {
        uint256 current = predicter.currentEpoch();

        (,,,,,,,,,,,,, bool oracleCalled) = predicter.rounds(current - 10);
        return oracleCalled;
    }
}
