// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

interface IResolutionManager {
    event ResolutionCreated(address indexed from, uint256 indexed resolutionId);

    event ResolutionUpdated(address indexed from, uint256 indexed resolutionId);

    event ResolutionApproved(
        address indexed from,
        uint256 indexed resolutionId
    );

    event ResolutionRejected(
        address indexed from,
        uint256 indexed resolutionId
    );

    event ResolutionVoted(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 votingPower,
        bool isYes
    );

    event ResolutionExecuted(
        address indexed from,
        uint256 indexed resolutionId
    );

    event ResolutionTypeCreated(
        address indexed from,
        uint256 indexed typeIndex
    );

    event DelegateLostVotingPower(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 amount
    );

    struct ResolutionType {
        string name;
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
        bool canBeNegative;
    }

    struct Resolution {
        string dataURI;
        uint256 resolutionTypeId;
        uint256 approveTimestamp;
        uint256 snapshotId;
        uint256 yesVotesTotal;
        bool isNegative;
        uint256 rejectionTimestamp;
        // Transaction fields
        address[] executionTo;
        bytes[] executionData;
        uint256 executionTimestamp;
        mapping(address => bool) hasVoted;
        mapping(address => bool) hasVotedYes;
        mapping(address => uint256) lostVotingPower;
    }

    function addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) external;

    function createResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) external returns (uint256);

    function approveResolution(uint256 resolutionId) external;

    function rejectResolution(uint256 resolutionId) external;

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative,
        address[] memory executionTo,
        bytes[] memory executionData
    ) external;

    function executeResolution(uint256 resolutionId) external;

    function vote(uint256 resolutionId, bool isYes) external;
}
