// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "../ResolutionManager/ResolutionManager.sol";

contract ResolutionManagerV2Mock is ResolutionManager {
    function reinitialize() public reinitializer(2) {
        resolutionTypes[6].noticePeriod = 1 days;
        resolutionTypes[6].votingPeriod = 1 days;
    }
}
