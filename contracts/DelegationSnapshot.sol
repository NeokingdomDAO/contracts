// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./Snapshottable.sol";
import "./Delegation.sol";
import "@openzeppelin/contracts/utils/Arrays.sol";

contract DelegationSnapshot is Delegation, Snapshottable {
    using Arrays for uint256[];

    struct Snapshots {
        uint256[] ids;
        address[] delegates;
        address[][] delegatorLists;
    }

    mapping(address => Snapshots) _delegationSnapshots;

    function snapshot() public virtual override returns (uint256) {
        return _snapshot();
    }
    
    function _beforeDelegate(address delegated) internal override {
        address oldDelegated = _delegates[msg.sender];
        
        Snapshots storage delegatorSnapshots = _delegationSnapshots[msg.sender];
        Snapshots storage delegatedSnapshots = _delegationSnapshots[delegated];
        Snapshots storage oldDelegatedSnapshots = _delegationSnapshots[oldDelegated];
        
        _updateSnapshot(oldDelegatedSnapshots, _delegates[oldDelegated], _delegators[oldDelegated]);
        _updateSnapshot(delegatorSnapshots, _delegates[msg.sender], _delegators[msg.sender]);
        _updateSnapshot(delegatedSnapshots, _delegates[delegated], _delegators[delegated]);
        
    }

    function getDelegatedAt(address account, uint256 snapshotId) public view returns (address) {
        Snapshots storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);
        
        return valid? snapshots.delegates[index] : _delegates[account];
    }

    function getDelegatorsAt(address account, uint256 snapshotId) public view returns (address[] memory) {
        Snapshots storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);
        
        return valid? snapshots.delegatorLists[index] : _delegators[account];
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
