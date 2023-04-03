// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "../RedemptionController/RedemptionController.sol";

contract RedemptionControllerProxy {
    RedemptionController redemptionController;

    uint256 total;
    address anAddress = 0x2e1aF63Cd595A6D715E5e2D92151801F0d406a6b;

    constructor() {
        redemptionController = new RedemptionController();
    }

    function redemption_afterMint(uint256 amount) public {
        if (total < 2 ** 256 - 1 - amount) {
            total += amount;
            redemptionController.afterMint(anAddress, amount);
        }
    }

    function redemption_afterOffer(uint256 amount) public {
        redemptionController.afterOffer(anAddress, amount);
    }

    function redemption_afterRedeem(uint256 amount) public {
        if (total > amount) {
            total -= amount;
            redemptionController.afterRedeem(anAddress, amount);
        }
    }

    function echidna_verifyBalance() public view returns (bool) {
        return redemptionController.redeemableBalance(anAddress) <= total;
    }
}
