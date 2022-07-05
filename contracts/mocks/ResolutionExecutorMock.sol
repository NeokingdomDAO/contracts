// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract ResolutionExecutorMock {
    event MockExecutionSimple(uint256 a);
    event MockExecutionArray(uint256[] a);

    function mockExecuteSimple(uint256 a) public {
        emit MockExecutionSimple(a);
    }

    function mockExecuteArray(uint256[] memory a) public {
        emit MockExecutionArray(a);
    }
}
