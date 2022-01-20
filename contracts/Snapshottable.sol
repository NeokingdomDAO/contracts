// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

abstract contract Snapshottable {
    event Snapshot(uint256 id);

    uint256 private _currentSnapshotId;

    function snapshot() public virtual returns (uint256);

    function _snapshot() internal returns (uint256) {
        _currentSnapshotId = block.timestamp;
        emit Snapshot(_currentSnapshotId);
        return _currentSnapshotId;
    }

    function _getCurrentSnapshotId() internal view returns (uint256) {
        return _currentSnapshotId;
    }
}
