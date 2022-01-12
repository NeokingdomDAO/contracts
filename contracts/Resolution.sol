// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ShareholdersRegistry {
    mapping(address => bool) public shareholders;
}

/* ERC-20 + snapshot */
contract TelediskoToken {
    uint256 public totalVotingTokens;
}

contract Resolution {
    struct ResolutionType {
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
    }

    struct ResolutionContent {
        uint256 resolutionType;
        uint256 snapshotId;
        bytes32 contentHash;
        uint256 timestamp;
        uint256 totalVotingTokens;
        address[] yesVoters;
        address[] noVoters;
        mapping(address => uint256) preference;
        // Derived:
        uint256 yes;
        uint256 no;
    }

    event Voted(
        uint256 indexed resolutionId,
        address shareholder,
        bool choice,
        uint256 share
    );

    mapping(uint256 => ResolutionContent) public resolutions;
    ResolutionType[6] public resolutionTypes = [
        // Fundamental
        ResolutionType(67, 14 days, 6 days),
        // Routine
        ResolutionType(51, 3 days, 2 days)
    ];

    // contentHash contains the e-card digital signature
    function createDraft(uint256 resolutionType, bytes32 contentHash)
        public
        returns (uint256 draftId)
    {}

    function getResolution(uint256 resolutionId) public view {
        // Returns details about the resolution and the state:
        // - notice period
        // - voting period
        // - end yes
        // - end no
        // - no quorum reached

        ResolutionContent storage resolution = resolutions[resolutionId];
        ResolutionType memory resolutionType = resolutionTypes[
            resolution.resolutionType
        ];

        string memory state;

        if (
            block.timestamp < resolution.timestamp + resolutionType.noticePeriod
        ) {
            state = "notice period";
        } else if (
            block.timestamp <
            resolution.timestamp +
                resolutionType.noticePeriod +
                resolutionType.votingPeriod
        ) {
            state = "voting period";
        } else {
            state = "ended";
        }

        uint256 yes;
        uint256 no;

        for (uint256 i = 0; i < resolution.yesVoters.length; i++) {
            address voter = resolution.yesVoters[i];
            yes += resolution.preference[voter];
        }

        for (uint256 i = 0; i < resolution.noVoters.length; i++) {
            address voter = resolution.noVoters[i];
            no += resolution.preference[voter];
        }

        // uint quorum = yes / resolution.totalVotingTokens;
        uint256 absoluteQuorum = resolutionType.quorum *
            resolution.totalVotingTokens;
        if (yes * 100 >= absoluteQuorum) {}
    }

    // function execute
}
