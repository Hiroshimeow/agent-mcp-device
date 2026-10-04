import assert from 'assert';
import { spawnSync } from 'child_process';
import { startProcess, readProcessOutput, forceTerminate, interactWithProcess } from '../dist/tools/improved-process-tools.js';

/**
 * Determines the correct python command to use
 * @returns {string|null} an executable Python command, or null when the
 * external interpreter dependency is unavailable on this test host.
 */
function getPythonCommand() {
  const candidates = process.platform === 'win32'
    ? [['python', []], ['py', ['-3']], ['python3', []]]
    : [['python3', []], ['python', []]];
  for (const [command, prefixArgs] of candidates) {
    const probe = spawnSync(command, [...prefixArgs, '--version'], { stdio: 'ignore', shell: false });
    if (!probe.error && probe.status === 0) return [command, ...prefixArgs].join(' ');
  }
  return null;
}


/**
 * Test enhanced REPL functionality
 */
async function testEnhancedREPL() {
  console.log('Testing enhanced REPL functionality...');
  
  const pythonCommand = getPythonCommand();
  if (!pythonCommand) {
    console.log('SKIP: enhanced Python REPL test requires a usable Python interpreter in PATH');
    return true;
  }
  console.log(`Using python command: ${pythonCommand}`);

  // Start Python in interactive mode
  console.log('Starting Python REPL...');
  const result = await startProcess({
    command: `${pythonCommand} -i`,
    timeout_ms: 10000
  });
  
  console.log('Result from start_process:', result);
  
  // Extract PID from the result text
  const pidMatch = result.content[0].text.match(/Process started with PID (\d+)/);
  const pid = pidMatch ? parseInt(pidMatch[1]) : null;
  
  if (!pid) {
    console.error("Failed to get PID from Python process");
    return false;
  }
  
  console.log(`Started Python session with PID: ${pid}`);
  try {
  // Test read_process_output with timeout
  console.log('Testing read_process_output with timeout...');
  const initialOutput = await readProcessOutput({ 
    pid, 
    timeout_ms: 2000 
  });
  console.log('Initial Python prompt:', initialOutput.content[0].text);
  
  // Test interact_with_process with wait_for_prompt
  console.log('Testing interact_with_process with wait_for_prompt...');
  const inputResult = await interactWithProcess({
    pid,
    input: 'print("Hello from Python with wait!")',
    wait_for_prompt: true,
    timeout_ms: 5000
  });
  console.log('Python output with wait_for_prompt:', inputResult.content[0].text);
  
  // Check that the output contains the expected text
  assert(inputResult.content[0].text.includes('Hello from Python with wait!'), 
    'Output should contain the printed message');
  
  // Test interact_with_process without wait_for_prompt
  console.log('Testing interact_with_process without wait_for_prompt...');
  await interactWithProcess({
    pid,
    input: 'print("Hello from Python without wait!")',
    wait_for_prompt: false
  });
  
  // Wait a moment for Python to process
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Read the output
  const output = await readProcessOutput({ pid });
  console.log('Python output without wait_for_prompt:', output.content[0].text);
  
  // Check that the output contains the expected text
  assert(output.content[0].text.includes('Hello from Python without wait!'), 
    'Output should contain the printed message');
  
  // Test multi-line code with wait_for_prompt
  console.log('Testing multi-line code with wait_for_prompt...');
  const multilineCode = `def greet(name):
    return f"Hello, {name}!"

for i in range(3):
    print(greet(f"Guest {i+1}"))`;
  
  // Send the multi-line code
  const blockResult = await interactWithProcess({
    pid,
    input: multilineCode,
    wait_for_prompt: true,
    timeout_ms: 5000
  });
  
  // Send an empty line to complete and execute the block
  const multilineResult = await interactWithProcess({
    pid,
    input: '',
    wait_for_prompt: true,
    timeout_ms: 5000
  });
  // Windows may report a continuation prompt before the final output arrives.
  // Preserve output from both calls and poll for the actual block result, not
  // the presence of a prompt (which can be stale).
  let multilineOutput = blockResult.content[0].text + multilineResult.content[0].text;
  const deadline = Date.now() + 10000;
  while (!multilineOutput.includes('Hello, Guest 3!') && Date.now() < deadline) {
    const next = await readProcessOutput({ pid, timeout_ms: 500 });
    multilineOutput += next.content[0].text;
    if (!multilineOutput.includes('Hello, Guest 3!')) await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('Python multi-line output with wait_for_prompt:', multilineOutput);
  
  // Check that the output contains all three greetings
  assert(multilineOutput.includes('Hello, Guest 1!'),
    'Output should contain greeting for Guest 1');
  assert(multilineOutput.includes('Hello, Guest 2!'),
    'Output should contain greeting for Guest 2');
  assert(multilineOutput.includes('Hello, Guest 3!'),
    'Output should contain greeting for Guest 3');
  
  return true;
  } finally {
    console.log('Terminating session...');
    await forceTerminate({ pid });
    console.log('Python session terminated');
  }
}

// Run the test
testEnhancedREPL()
  .then(success => {
    console.log(`Enhanced REPL test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });