// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../extensions/ISnapshot.sol";

interface ITelediskoToken is IERC20, ISnapshot {
    function balanceOfAt(address account, uint256 snapshotId)
        external
        view
        returns (uint256);

    function totalSupplyAt(uint256 snapshotId) external view returns (uint256);
}
