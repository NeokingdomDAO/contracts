// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

abstract contract IShareholderRegistry {
  function SHAREHOLDER_STATUS() external virtual returns (bytes32);
  function INVESTOR_STATUS() external virtual returns (bytes32);
  function CONTRIBUTOR_STATUS() external virtual returns (bytes32);
  function FOUNDER_STATUS() external virtual returns (bytes32);

  function getStatus(address account) external virtual returns (bytes32);

  function getStatusAt(address account, uint256 snapshotId)
    external
    virtual
    returns (bytes32);

  function isAtLeast(bytes32 status, address account)
    external
    virtual
    returns (bool);

  function isAtLeastAt(
    bytes32 status,
    address account,
    uint256 snapshotId
  ) external virtual returns (bool);

  function balanceOfAt(address account, uint256 snapshotId)
    external
    virtual
    returns (uint256);

  function balanceOf(address account) external virtual returns (uint256);

  function totalSupplyAt(uint256 snapshotId) external virtual returns (uint256);

  function totalSupply() external virtual returns (uint256);
}
