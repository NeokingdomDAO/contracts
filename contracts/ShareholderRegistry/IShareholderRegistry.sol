// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../extensions/ISnapshot.sol";

interface IShareholderRegistry is ISnapshot {
    function SHAREHOLDER_STATUS() external returns (bytes32);

    function INVESTOR_STATUS() external returns (bytes32);

    function CONTRIBUTOR_STATUS() external returns (bytes32);

    function MANAGING_BOARD_STATUS() external returns (bytes32);

    function getStatus(address account) external returns (bytes32);

    function getStatusAt(address account, uint256 snapshotId)
        external
        returns (bytes32);

    function isAtLeast(bytes32 status, address account) external returns (bool);

    function isAtLeastAt(
        bytes32 status,
        address account,
        uint256 snapshotId
    ) external returns (bool);

    function balanceOfAt(address account, uint256 snapshotId)
        external
        returns (uint256);

    function balanceOf(address account) external returns (uint256);

    function totalSupplyAt(uint256 snapshotId) external returns (uint256);

    function totalSupply() external returns (uint256);
}
