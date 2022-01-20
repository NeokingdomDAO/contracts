// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./Snapshottable.sol";
import "@openzeppelin/contracts/utils/Arrays.sol";

abstract contract IDelegation is Snapshottable {
    function snapshot() public virtual override returns (uint256) {
        return _snapshot();
    }

    function getDelegatedAt(address, uint256) external virtual returns (address);
    function getDelegatorsAt(address, uint256) external virtual returns (address[] memory);
    function getVotingPowerAt(address, uint256) external virtual returns (uint256);

    function getDelegated(address) external virtual returns (address);
    function getDelegators(address) external virtual returns (address[] memory);
    function getVotingPower(address) external virtual returns (uint256);

    function delegate(address delegated) external virtual;
}

contract Delegation is IDelegation {
    using Arrays for uint256[];

    struct Snapshots {
        uint256[] ids;
        address[] delegates;
        address[][] delegatorLists;
    }

    mapping(address => Snapshots) _delegationSnapshots;

    function delegate(address delegated) external override {
        Snapshots storage delegatorSnapshots = _delegationSnapshots[msg.sender];
        address[] storage delegatorLastDelegators = delegatorSnapshots.delegatorLists[_lastSnapshotId(delegatorSnapshots.ids)];
        _updateSnapshot(delegatorSnapshots, delegated, delegatorLastDelegators);

        Snapshots storage delegatedSnapshots = _delegationSnapshots[delegated];
        uint256 delegatedLastSnapshotId = _lastSnapshotId(delegatedSnapshots.ids);
        address currentDelegate = delegatedSnapshots.delegates[delegatedLastSnapshotId];
        address[] memory delegatedLastDelegators = delegatedSnapshots.delegatorLists[delegatedLastSnapshotId];
        delegatedLastDelegators[delegatedLastDelegators.length] = msg.sender;
        _updateSnapshot(delegatedSnapshots, currentDelegate, delegatedLastDelegators);
    }


    function getDelegated(address account) external view override returns (address) {
        return getDelegatedAt(account, _getCurrentSnapshotId());
    }

    function getDelegators(address account) external view override returns (address[] memory) {
        return getDelegatorsAt(account, _getCurrentSnapshotId());
    }

    function getVotingPower(address) external override returns (uint256) {

    }
    
    function getVotingPowerAt(address, uint256) external override returns (uint256) {

    }
            
    function getDelegatedAt(address account, uint256 snapshotId) public view override returns (address) {
        return _delegateAt(snapshotId, _delegationSnapshots[account]);
    }

    function getDelegatorsAt(address account, uint256 snapshotId) public view override returns (address[] memory) {
        return _delegatorsAt(snapshotId, _delegationSnapshots[account]);
    }

    function _getSnapshotIndex(uint256 snapshotId, Snapshots storage snapshots) internal view returns (uint256) {
        require(snapshotId > 0, "ERC20Snapshot: id is 0");
        require(snapshotId <= _getCurrentSnapshotId(), "ERC20Snapshot: nonexistent id");

        uint256 index = snapshots.ids.findUpperBound(snapshotId);

        if (index == snapshots.ids.length) {
            return index - 1;
        } else {
            return index;
        }
    }

    function _delegatorsAt(uint256 snapshotId, Snapshots storage snapshots) private view returns (address[] memory) {
        return snapshots.delegatorLists[_getSnapshotIndex(snapshotId, snapshots)];
    }

    function _delegateAt(uint256 snapshotId, Snapshots storage snapshots) private view returns (address) {
        return snapshots.delegates[_getSnapshotIndex(snapshotId, snapshots)];
    }

    function _updateSnapshot(Snapshots storage snapshots, address currentDelegate, address[] memory currentDelegators) private {
        uint256 currentId = _getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.delegates.push(currentDelegate);
            snapshots.delegatorLists.push(currentDelegators);
        }
    }

    function _lastSnapshotId(uint256[] storage ids) private view returns (uint256) {
        if (ids.length == 0) {
            return 0;
        } else {
            return ids[ids.length - 1];
        }
    }
}
