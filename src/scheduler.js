import {Distribution} from "./probability";
import * as process from "./process";

function* multiple_ordered(generators) {
	var first_elements = [];
	
	for generator of generators {
		first_value = generator.next();
		
		if first_value !== undefined
			first_elements.push([generator, first_value]);
	}
	
	while(first_elements.length > 0) {
		first_elements.sort((a, b) => { a[1] > b[1] }); // Sort by descending values
		
		var entry = first_elements.pop();
		yield entry[1];
		
		var next_element = entry[0].next();
		if next_element !== undefined
			first_elements.push([entry[0], next_element]);
	}
}

function* iterate_dynamic(source) {
	var data = source().slice();
	data.sort();
	
	while(data.length > 0) {
		var pivot = data[0];
		yield pivot;
		
		data = source().filter(x => {x > pivot});
		data.sort();
	}
}

function schedule(generators, processes, inventory) {
	// Prepare initial state of scheduler (start inventory, no running processes)
	var state = Distribution.wrap({
		running = [],
		inventory = inventory
	});
	
	// Generator for generating the scheduling times
	var global_generator = multiple_ordered(generators);
	
	for scheduling_point of global_generator {		
		// Apply finished tasks
		state = state.map(
			(prev_state) => {
				// Wrap the (now single-option) inventory again in the probability wrapper
				inventory_distribution = Distribution.wrap(prev_state.inventory);
				
				// For each finished proces...
				for entry in prev_state.running {
					var process = entry.process;
					
					if entry.t_start + process.duration <= scheduling_point {
						// ... apply a probabilistic modification based on the success chance
						inventory_distribution = inventory_distribution.map(
							(inventory) => {
								function eval_result(succ) {
									tmp = inventory.clone();
									process.end(tmp, succ);
									return tmp;
								}
								
								dist = new Distribution();
								dist.probabilities.set(eval_result(true), process.probability);
								dist.probabilities.set(eval_result(false), 1 - process.probability);
								
								return dist;
							}
						);
					}
				}
				
				// Combine all the possible inventories with the common list of running processes
				still_running = prev_state.running.filter(entry => { entry.t_start + entry.process.duration > scheduling_point });
				
				return inventory_distribution.map(inv => {
					Distribution.wrap({
						running = still_running,
						inventory = inv
					})
				});
			}
		);
		
		// Now try to schedule all processes
		scheduling_attempts = state.map(
			(state) => {
				inventory = state.inventory.clone();
				scheduled = [];
				
				// Try to schedule each process (the start method modified the states as neccessary)
				for process of processes {
					try {
						process.start(inventory);
						scheduled.push(process);
					} catch(e) {
					}
				}
				
				// 
			}
		);
	}
}

class Schedule {
	
}