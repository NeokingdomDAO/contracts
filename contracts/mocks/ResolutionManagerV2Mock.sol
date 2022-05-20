// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../ResolutionManager/ResolutionManager.sol";
import "../extensions/Roles.sol";

contract ResolutionManagerV2Mock is ResolutionManager {
    function reinitialize() public reinitializer(2) {
        resolutionTypes[6].noticePeriod = 1 days;
        resolutionTypes[6].votingPeriod = 1 days;
    }
}
