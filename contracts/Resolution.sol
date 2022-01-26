// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Voting/VotingSnapshot.sol";

interface IERC20Mintable is IERC20 {
    function mint(address, uint256) external;
}

contract Resolution {
    VotingSnapshot voting;
    IERC20 token;

    struct ResolutionContent {
        //uint256 resolutionType;
        uint256 snapshotId;
        bytes32 contentHash;
        uint256 yesVotes;
        uint256 quorum;
        //uint256 timestamp;

        mapping(address => uint256) votes;
        mapping(address => bool) preference; // false = no, true = yes
        mapping(address => bool) hasVoted;
        mapping(address => bool) delegatorHasVoted;
        Payout payout;
    }

    struct Payout {
        address[] receivers;
        uint256[] amounts;
        IERC20Mintable token;
        bool mint;
    }

    event Voted(
        uint256 indexed resolutionId,
        address shareholder,
        bool choice,
        uint256 share
    );

    mapping(uint256 => ResolutionContent) public resolutions;

    function getResolutionResult(uint256 resolutionId)
        public
        view
        returns (bool)
    {
        ResolutionContent storage resolution = resolutions[resolutionId];

        uint256 totalVotes = voting.getTotalVotingPowerAt(
            resolution.snapshotId
        );
        uint256 absoluteQuorum = resolution.quorum * totalVotes;
        return resolution.yesVotes * 100 >= absoluteQuorum;
    }

    // Returns for each address whether it voted and, in case, what
    function getVotersSummary(uint256 resolutionId)
        public
        view
        returns (
            address[] memory,
            bool[] memory,
            bool[] memory
        )
    {
        ResolutionContent storage resolution = resolutions[resolutionId];
        // Get all voters -> from snapshot on ShareholderRegistry
        address[] memory voters;
        bool[] memory hasVoted = new bool[](voters.length);
        bool[] memory preferences = new bool[](voters.length);

        // For each voter
        for (uint256 i = 0; i < voters.length; i++) {
            // if it voted
            address voter = voters[i];
            address delegate = voting.getDelegateAt(
                voter,
                resolution.snapshotId
            );
            hasVoted[i] = resolution.hasVoted[voter];
            if (resolution.hasVoted[voter]) {
                // get its vote
                preferences[i] = resolution.preference[voter];
            }
            // else if it has a delegate
            else if (voter != delegate && resolution.hasVoted[delegate]) {
                // get delegate's vote
                preferences[i] = resolution.preference[delegate];
            } else {
                // it voted no
                preferences[i] = false;
            }
        }

        return (voters, hasVoted, preferences);
    }

    function _getCurrentVotingPower(
        address account,
        ResolutionContent storage resolution
    ) internal view returns (uint256) {
        // If neither the voter, nor any of its delegators voted, the total amount of votes is the one contained in "Voting",
        // namely: voter's votes + delegators' votes

        // If any of the delegators already voted, the voting power is: voter's votes - delegator's voting power. This value
        // is computed incrementally as the delegators vote the resolution and stored inside "votes"

        uint256 votingPower = resolution.votes[account];

        if (
            !resolution.hasVoted[account] &&
            !resolution.delegatorHasVoted[account]
        ) {
            votingPower = voting.getVotingPowerAt(
                account,
                resolution.snapshotId
            );

            if (votingPower == 0) {
                votingPower = token.balanceOf(account); // TODO: use balanceOfAt as soon as contract available
            }
        }

        return votingPower;
    }

    function _updateDelegateVotes(
        address delegate,
        uint256 delegatorVotes,
        ResolutionContent storage resolution
    ) internal {
        if (!resolution.hasVoted[delegate]) {
            resolution.votes[delegate] = voting.getVotingPowerAt(
                delegate,
                resolution.snapshotId
            );
        }

        resolution.votes[delegate] =
            resolution.votes[delegate] -
            delegatorVotes;

        resolution.delegatorHasVoted[delegate] = true;
    }

    function vote(bool preference, uint256 resolutionId) public {
        ResolutionContent storage resolution = resolutions[resolutionId];

        // Load voting power of the voter
        uint256 senderVotes = _getCurrentVotingPower(msg.sender, resolution);

        // Load the delegate of the voter
        address delegate = voting.getDelegateAt(
            msg.sender,
            resolution.snapshotId
        );

        // If the delegate has voted already...
        if (resolution.hasVoted[delegate]) {
            // Subtract from delegate the votes of the current voter
            resolution.votes[delegate] =
                resolution.votes[delegate] -
                senderVotes;

            // Mark that the delegator has voted (useful for `getCurrentVotingPower`)
            resolution.delegatorHasVoted[delegate] = true;
        }

        // Store the preference YES/NO for the voter
        resolution.preference[msg.sender] = preference;
        // Mark that the voter has voted
        resolution.hasVoted[msg.sender] = true;
        resolution.votes[msg.sender] = senderVotes;

        // If the voter is voting differently from their delegate...
        if (
            resolution.preference[msg.sender] != resolution.preference[delegate]
        ) {
            // Update the yesVotes counter
            if (resolution.preference[msg.sender]) {
                resolution.yesVotes += senderVotes;
            } else {
                resolution.yesVotes -= senderVotes;
            }
        }
    }
}
