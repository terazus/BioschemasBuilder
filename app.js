(function () {
	var app = angular.module('builder', ['ngMaterial', 'ngMessages', 'ngAria', 'ngAnimate'])
	.config(function($mdThemingProvider) {
	  	$mdThemingProvider.theme('default')
		    .primaryPalette('teal');
	});

	var specification_is_built = false;
	var output_is_built = false;

	app.controller('SpecificationBuilder', function(){
		if (specification_is_built == false){
			this.specs = make_specs(mainSpecificationName);
			specification_is_built = true;
			//console.log(this.specs);
		}

		function make_specs(allowed_objects){

			var string_types = ["url", "email", "date", "text", "number"];

			// Setting up needed variables
			var newSpec = {}; // This is the spec that we are going to return at the end of the function
			newSpec.fields = {};
			var item_path = 'specifications/'+allowed_objects+'/specification.html';
			var yml_spec = parse_spec_file(item_path, 'yml');
			var specification = yml_spec[0]; // Getting the specification

			if (yml_spec == false){
				return false;
			}

			// These are for later!
			var fields_list = {
				required: [],
				recommended: [],
				optional: []
			};

			// Let's iterate over the fields properties
			for (parentFieldName in specification){

				// Isolating the properties field
				if (parentFieldName != "properties"){
					newSpec[parentFieldName] = specification[parentFieldName];
				}

				// Properties are isolated in this loop!
				else {

					var fields = specification[parentFieldName];

					// iterating over the properties field (this is where the actual fields are held)
					for (fieldKey in fields){
						var fieldProperties = fields[fieldKey];
						var expectedTypes = fieldProperties.expected_type;

						
						// Cleaning up identifier -- to be removed --
						if (fieldProperties.name == "identifier") {	
							expectedTypes = ["url"]; 
							fieldProperties.expected_type = expectedTypes;
						}

						// Cleaning up location -- to be removed --
						if (fieldProperties.name == "location") { 
							expectedTypes = ["PostalAddress"];
							fieldProperties.expected_type = expectedTypes;
							fieldProperties.bsc_dec = {
								"@type": "PostalAddress",
								"fields": ["name"]
							};
						}

						// Transforming bsc_dec to an array if it's a string
						if (fieldProperties.bsc_dec != "" 
							&& fieldProperties.bsc_dec != undefined 
							&& fieldProperties.bsc_dec != null 
							&& fieldProperties.bsc_dec != undefined 
							&& typeof fieldProperties.bsc_dec == 'string'){
					
							// Is it parsable?
							try{

								var firstParse = fieldProperties.bsc_dec.split(";");
								if (firstParse.length > 1){
									console.log("Woot but not yet");
								}
								else{
									subfields = parseBSC_DEC(firstParse);
									if (subfields == false){
										fieldProperties.sdo_desc = fieldProperties.bsc_dec;
										fieldProperties.bsc_dec = undefined;
									}
									else{
										fieldProperties.bsc_dec = subfields;
									}
								}

							}
							catch(e){
								fieldProperties.bsc_dec = undefined;
							}
							
						}

						expectedTypes = _.without(expectedTypes, "DateTime");
						fieldProperties.expected_type = expectedTypes;

						// Keep cleaning expected types by iterating over the expectedTypes item.
						for (itemKey in expectedTypes){
							var item = expectedTypes[itemKey];

						
							// Switching integer to number for HTML compatibility
							if (item=="Integer"||item=="integer"||item=="int"){
								item = "number";
								expectedTypes[itemKey] = "number";
								fieldProperties.expected_type=expectedTypes;
							}

							//Cleaning up DateTime to date for HTML compatiblity
							if (item=="DateTime"){
								item = "date";
								expectedTypes[itemKey] = "date";
								fieldProperties.expected_type=expectedTypes;
							}

							// If the item is not a string type (an object input is expected)
							if (string_types.indexOf(item.toLowerCase())==-1){


								// The input is an object but there is no spec in the BSC_DEC variable
								if (fieldProperties.bsc_dec == "" || fieldProperties.bsc_dec == undefined || fieldProperties.bsc_dec == null){

									// Try to load the spec from /specifications/ folder
									if (item!=mainSpecificationName){ var subSpec = make_specs(item); }

									//Preventing endless loop
									else{
										var subSpec = false;
									}
									
									// The spec couldn't be loaded, clean up the field
									if (subSpec == false){
										if (fieldProperties.expected_type.length > 1){
											fieldProperties.expected_type = _.without(fieldProperties.expected_type, item);
										}
										else {
											fieldProperties.expected_type = ["Text"];
										}
										delete fieldProperties.bsc_dec;

									}

									// The spec has been correctly loaded
									else{
										fieldProperties.fields = [];
										fieldProperties.fields.push({
											"@type":subSpec.name,
											"fields": subSpec.fields
										});
										delete fieldProperties.bsc_dec;
									}
									//addFieldtoSpec(fieldProperties, fields_list);
								}

								// There is something in the BSC_DEC and the input is an object
								else{
									if (fieldProperties.bsc_dec["@type"].toLowerCase() == item.toLowerCase()){
										fieldProperties.fields = fieldProperties.bsc_dec;
										delete fieldProperties.bsc_dec;
									} 
									else{
										// Tweek here if we want to insert a template!
										if (fieldProperties.expected_type.length>1){
											fieldProperties.expected_type =  _.without(fieldProperties.expected_type, item);
										}
										else{
											fieldProperties.expected_type = ["Text"];
										}
									}
								}
								
							}
						}

						// If there is only one expected type left
						if (fieldProperties.expected_type.length==1) {

							// It's a string
							if (string_types.indexOf(fieldProperties.expected_type[0].toLowerCase())!=-1){
								//fieldProperties.expected_type = expectedTypes;
																
								if (fieldProperties.name=="description"){
									fieldProperties.output = 'textarea';
								}
								else{
									fieldProperties.output = 'input';
								}

								delete fieldProperties.bsc_dec;
								addFieldtoSpec(fieldProperties, fields_list);
							}

							// It's an object
							else{
								if (fieldProperties.fields[0] != undefined){
									fieldProperties.output = 'import';
								}
								else{
									fieldProperties.output = 'object';
								}

								addFieldtoSpec(fieldProperties, fields_list);
							}
						}

						else if (fieldProperties.expected_type.length>1){
							
							fieldProperties.expected_type = _.without(fieldProperties.expected_type, "Text");			
							if (fieldProperties.expected_type.length>1){
								fieldProperties.expected_type = _.without(fieldProperties.expected_type, "URL");
							}
							if (string_types.indexOf(fieldProperties.expected_type[0].toLowerCase())!=-1){
									fieldProperties.output = 'input';
							}
							else{
								if (fieldProperties.fields[0] != undefined){
									fieldProperties.output = 'import';
								}
								else{
									fieldProperties.output = 'object';
								}
							}
							addFieldtoSpec(fieldProperties, fields_list);;
						}
						
					}
				}
			}

			newSpec.fields = fields_list;
			return newSpec;
		}

		function parseBSC_DEC(subfield){
			var secondSplit = subfield[0].split(":");
			if (secondSplit.length<=1){
				return false;
			}
			else{
				var thirdSplit = secondSplit[1].split(',');
				var subItemSpec = {
					"@type": secondSplit[0],
					"fields": thirdSplit
				};
				return subItemSpec;
			}
		}

		function addFieldtoSpec(field, fields_list){
			if (field.marginality == 'Minimum'){
				if (weightedRequiredFields[field.name] == undefined){
					var field_priority = 6;
				}
				else{
					var field_priority = weightedRequiredFields[field.name];
				}
				field.priority = field_priority;
				fields_list.required.push(field);
			}
			else if (field.marginality == 'Recommended'){
				fields_list.recommended.push(field);
			}
			else if (field.marginality == 'Optional'){
				fields_list.optional.push(field);
			}
		}

		function parse_spec_file(src, method){
			var request = new XMLHttpRequest();
			request.open("GET", src, false);
			try{
				request.send(null);
				if (method=='yml'){
					var my_yml = yaml.load_all(request.responseText);
					return my_yml;
				}		
			}
			catch(e){
				return false;
			}
		}
	});

	app.controller('OutputBuilder', function(){

		this.error = "";
		this.json = {
			"@type": 'DataCatalog',
			"@context": 'http://schema.org'
		}

		this.fieldToArray = function(field_name){
			if (this.json[field_name]==undefined){
				this.json[field_name] = [];
			}
		}

		this.addNewValue = function(field_name){
			var lastValue = this.json[field_name][this.json[field_name].length - 1];
			if (lastValue != {}){
				this.json[field_name].push({});
			}
		}		

		this.uniq = function(a) {
		    var prims = {"boolean":{}, "number":{}, "string":{}}, objs = [];

		    return a.filter(function(item) {
		        var type = typeof item;
		        if(type in prims)
		            return prims[type].hasOwnProperty(item) ? false : (prims[type][item] = true);
		        else
		            return objs.indexOf(item) >= 0 ? false : objs.push(item);
		    });
		}

		this.cleanArray = function(actual) {
			var newArray = new Array();
			if (actual != undefined){
				for (var i = 0; i < actual.length; i++) {
				    if (actual[i]) {
				      newArray.push(actual[i]);
				    }
				}
				if (newArray.length == 0){
					return undefined;
				}
				return newArray;
			}
  			return undefined;
		}

		this.remove_item = function(field_name, item_index){

			var output_array = [];			
			//this.json[field_name] = this.json[field_name].slice(item_index, 0);

			for (key in this.json[field_name]){
				if (key != item_index){
					output_array.push(this.json[field_name][key])
				}
			}

			if (output_array.length == 0){
				output_array = [""];
			}
			this.json[field_name] = output_array;
		}
	});

	app.controller('PanelController', function(){

		this.go_to_required = function (){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("mainContainer").style.left = "-3500px";
			document.getElementById("mainContainer").style.opacity = "0";
			document.getElementById("editRequired").style.left = "0px";
			document.getElementById("editRequired").style.opacity = "1";
			//document.getElementById("editRecommended").style.left = "2000px";
			//document.getElementById("editRecommended").style.opacity = "0";
		}

		this.go_to_start = function(){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("mainContainer").style.left = "0px";
			document.getElementById("editRequired").style.left = "2000px";
			document.getElementById("editRequired").style.opacity = "0";
			document.getElementById("mainContainer").style.opacity = "1";
		}

		this.go_to_dataset = function(){
			$('html, body').animate({ scrollTop: 0 });
			//document.getElementById("editRecommended").style.left = "-3500px";
			//document.getElementById("editDataset").style.left = "0px";
			//document.getElementById("output").style.left = "2000px";		
			//document.getElementById("editRecommended").style.opacity = "0";
			//document.getElementById("output").style.opacity = "0";
			//document.getElementById("editDataset").style.opacity = "1";
		}

		this.go_to_recommended = function(state){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("editRequired").style.left = "-3500px";
			//document.getElementById("editRecommended").style.left = "0px";
			//document.getElementById("editDataset").style.left = "2000px";
			document.getElementById("editRequired").style.opacity = "0";
			//document.getElementById("editDataset").style.opacity = "0";
			//document.getElementById("editRecommended").style.opacity = "1";
		}

		this.change_chevron = function(target_id){
			if (document.getElementById(target_id).classList.contains("fa-chevron-down")) {
				document.getElementById(target_id).classList.remove("fa-chevron-down");
				document.getElementById(target_id).classList.add("fa-chevron-right");
			}
			else if (document.getElementById(target_id).classList.contains("fa-chevron-right")) {
				document.getElementById(target_id).classList.add("fa-chevron-down");
				document.getElementById(target_id).classList.remove("fa-chevron-right");
			}
		}
	});

	var mainSpecificationName = "DataCatalog";

	var weightedRequiredFields = {
		'name': 1,
		'url': 2,
		'description': 3,
		'endDate': 5,
		'startDate': 4,
		'keywords': 4,
		'provider': 5
	};

	app.filter('reverse', function() { 
		return function(items) { 
			return items.slice().reverse();	
		}; 
	});

	app.filter('object2Array', function() {
	    return function(input) {
	    	var out = []; 
	    	for(i in input){
	    		out.push(input[i]);
	    	}
	      	return out;
    	}
    });

	app.filter("trust", ['$sce', function($sce) {
	  	return function(htmlCode){
	    	return $sce.trustAsHtml(htmlCode);
	 	}
	}]);


	app.directive('topHeader', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/header.html'
		};
	});

	app.directive('objectDetails', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/object-details.html'
		};
	});

	app.directive('fieldIterator', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/fields-iterator.html',
		}
	});

	app.directive('fieldInput', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/fields/field-input.html',
			link: function(scope, element, attrs){
				var field_as_json = angular.fromJson(attrs.fieldproperties);
				scope.field = field_as_json ;
			}
		};
	});

	app.directive('fieldObject', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/fields/field-object.html'
		};
	});

	app.directive('fieldImport', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/fields/field-import.html',
		};
	});

	app.directive('errorHandler', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/fields/error-handler.html'
		};
	});

})();