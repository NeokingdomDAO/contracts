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

    mapping(address => address) _delegates;
    mapping(address => address[]) _delegators;
    

    function delegate(address delegated) external override {
        address oldDelegated = _delegates[msg.sender];
        
        Snapshots storage delegatorSnapshots = _delegationSnapshots[msg.sender];
        Snapshots storage delegatedSnapshots = _delegationSnapshots[delegated];
        Snapshots storage oldDelegatedSnapshots = _delegationSnapshots[oldDelegated];
        
        _updateSnapshot(oldDelegatedSnapshots, _delegates[oldDelegated], _delegators[oldDelegated]);
        _updateSnapshot(delegatorSnapshots, _delegates[msg.sender], _delegators[msg.sender]);
        _updateSnapshot(delegatedSnapshots, _delegates[delegated], _delegators[delegated]);
        
        _removeDelegator(_delegators[oldDelegated], msg.sender); 
        _delegates[msg.sender] = delegated;
        _delegators[delegated].push(msg.sender);
    }


    function getDelegated(address account) external view override returns (address) {
        return _delegates[account];
    }

    function getDelegators(address account) external view override returns (address[] memory) {
        return _delegators[account];
    }

    function getVotingPower(address) external override returns (uint256) {

    }
    
    function getVotingPowerAt(address, uint256) external override returns (uint256) {

    }
            
    function getDelegatedAt(address account, uint256 snapshotId) public view override returns (address) {
        Snapshots storage snapshot = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshot.ids);
        
        return valid? snapshot.delegates[index] : _delegates[account];
    }

    function getDelegatorsAt(address account, uint256 snapshotId) public view override returns (address[] memory) {
        Snapshots storage snapshot = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshot.ids);
        
        return valid? snapshot.delegatorLists[index] : _delegators[account];
    }

    function _removeDelegator(address[] storage delegators, address toRemove) internal {
        // TODO
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

    function _updateSnapshot(Snapshots storage snapshots, address currentDelegate, address[] memory currentDelegators) private {
        uint256 currentId = _getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.delegates.push(currentDelegate);
            snapshots.delegatorLists.push(currentDelegators);
        }
    }
}
