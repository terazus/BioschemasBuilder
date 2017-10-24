(function () {
	var app = angular.module('builder', []);

	app.controller('SpecificationBuilder', function(){
		this.specs = make_specs(allowed_objects);

		function make_specs(allowed_objects){
			var specs = [];

			for (key in allowed_objects){
				item_path = 'specifications/'+allowed_objects[key]+'/specification.html';
				yml_spec = parse_spec_file(item_path, 'yml');
				item_spec = yml_spec[0];
				console.log(yml_spec);
				

				if (item_spec.name == "DataCatalog"){

					var required = [];
					var recommended = [];
					var optional = [];

					for (subkey in yml_spec[0].properties){
						var field = yml_spec[0].properties[subkey];					

						if (field.marginality == 'Minimum'){
							required.push(field);
						}

						if (field.marginality == 'Recommended'){
							recommended.push(field);
						}
					
						if (field.marginality == 'Optional'){
							optional.push(field);
						}
					}

					item_spec.properties = [
						{
							state: 'required',
							fields: required
						},
						{
							state: 'recommended',
							fields: recommended
						},
						{

							state: 'optional',
							fields: optional							
						}
					];
				}


				specs.push(
				{
					name: allowed_objects[key],
					spec: item_spec
				});
			}

			return specs;
		}

		function parse_spec_file(src, method){
			var request = new XMLHttpRequest();
			request.open("GET", src, true);
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
			"@context": 'http://schema.org',
		}

		this.initiate_fields = function(){
			var fields = {
				required: {
					keywords: [""],
					name: "",
					url: "",
					description: "",
					provider: null
				},
				recommended: {
					citation: [{"@type": 'CreativeWork'}],
					license: {"@type": "CreativeWork"},
					alternateName: [""],
					identifier: [""],
					datePublished: "",
					dateModified: "",
					dataset: [{"@type": "Dataset", identifier:[""], keywords:[""]}]
				}
			}
			return fields;
		}

		this.fields = this.initiate_fields();

		this.initiate_json = function(){
			for (field_name in this.fields.required){
				field_value = this.fields.required[field_name];
				if (field_name == 'provider'){
					var provider = {};
					if (field_value.type == 'Person'){
						provider['email'] = field_value.email;
					}
					else if(field_value.type == 'Organization'){
						provider['url'] = field_value.url;
					}
					provider['@type'] = field_value.type;
					provider['name'] = field_value.name;
					this.json.provider = provider;
				}
				else if (field_name == 'keywords'){
					if (field_value.length == 1){
						this.json[field_name] = field_value[0];
					}
					else{
						this.json[field_name] = this.cleanArray(this.uniq(field_value));
					}
				}
				else{
					this.json[field_name] = field_value;
				}
				this.json['@id'] = this.fields.required.url;
			}
		}

		this.add_recommended_fields = function(){
			for (field_name in this.fields.recommended){
				field_value = this.fields.recommended[field_name];

				// Field is a string
				if (typeof field_value != 'object'){
					if (field_value != ""){
						this.json[field_name] = field_value;
					}
					else{
						this.json[field_name] = undefined;
					}
				}

				// Field is either an object either an array
				else {

					// Field is an array
					if (field_value.hasOwnProperty('length')){

						// Field is not Articles, not Dataset => it's an array of strings
						if (field_name != 'citation' && field_name != 'dataset'){

							// Array isn't 'empty'
							if (field_value!=[""] && field_value[0]!=""){
								//clean the array but removing empty strings and dupes
								var cleanedArray = this.cleanArray(this.uniq(field_value));

								// Array contains 1 element
								if (field_value.length == 1 || cleanedArray.length == 1){
									this.json[field_name] = field_value[0];
								}
								// Array cotnains more than one element
								else{
									this.json[field_name] = cleanedArray; 
								}

							}
							else{
								this.json[field_name] = undefined;
							}	
						}

						else{

							// The array only has one value
							if (field_value.length == 1)
							{
								// Citation Field
								if (field_name == 'citation'){ 
									this.json['citation'] = this.processCitation(field_value[0]);						
								}
								// Dataset Field
								if (field_name == 'dataset'){
									this.json['dataset'] = this.processDataset(field_value[0]);
								}
							}

							else{
								var temp_array = [];

								for (key in field_value){
									item = field_value[key];
									if (field_name == 'citation'){
										var tested_item = this.processCitation(item);
										if (tested_item != undefined){
											temp_array.push(tested_item);
										}
									}

									else if (field_name == 'dataset'){
										var tested_item = this.processDataset(item);
										if (tested_item != undefined){
											temp_array.push(tested_item);
										}
									}
								}
								if (temp_array.length > 0){
									if (temp_array.length == 1){
										this.json[field_name] = temp_array[0];
									}
									else{
										this.json[field_name] = temp_array;
									}
								}
							}
						}
					}

					// Field is a plain object (actually, only License should be included)
					else {
						if ((field_value.name != undefined && field_value.name != "")
							&& (field_value.url != undefined && field_value.url != "")){
							this.json[field_name] = field_value;
						}
						else{
							this.json[field_name] = undefined;
						}
					}
				}
			}
		}


		this.processCitation = function(citation){
			if (citation.name != undefined 
				&& citation.name != "" 
				&& citation.url != undefined 
				&& citation.url != "" )
			{
					return citation;
			}
			else{
				return undefined;
			}
		}

		this.processDataset = function(dataset){
			if (dataset.name != undefined 
				&& dataset.name != "" 
				&& dataset.url != undefined 
				&& dataset.url != ""
				&& dataset.keywords != undefined 
				&& dataset.keywords != ""
				&& dataset.keywords != [""] )
			{
					if (this.cleanArray(dataset.identifier) == undefined){
						dataset.identifiers = undefined;
					}
					return dataset;
			}
			else{
				return undefined;
			}
		}


		this.add_keyword = function(){
			this.fields.required.keywords.push("");
		}

		this.add_alt_name = function(){
			this.fields.recommended.alternateName.push("");
		}

		this.add_identifier = function(){
			this.fields.recommended.identifier.push("");
		}

		this.add_citation = function(){
			this.fields.recommended.citation.push({name:"", url:"", description:"", "@type":"CreativeWork"});
		}

		this.add_dataset = function(){
			this.fields.recommended.dataset.push({"@type":"Dataset", identifier:[""], keywords:[""]});
		}

		this.add_dataset_identifier = function(dataset){
			dataset.identifier.push("");
		}

		this.add_dataset_keyword = function(dataset){
			dataset.keywords.push("");
		}

		this.go_to_start = function(){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("mainContainer").style.left = "0px";
			document.getElementById("editRequired").style.left = "2000px";
			document.getElementById("editRequired").style.opacity = "0";
			document.getElementById("mainContainer").style.opacity = "1";
		}

		this.go_to_recommended = function(state){
			var errors = false;

			if (state == 'Next'){
				for (field_name in this.fields.required){
					field_value = this.fields.required[field_name];
					if (field_value == null || field_value.length == 0 || field_value == undefined || field_value[0] == ""){
						errors = true;
					}
				}

				if (errors==false){
					this.error = "";
					$('html, body').animate({ scrollTop: 0 });
					document.getElementById("editRequired").style.left = "-3500px";
					document.getElementById("editRecommended").style.left = "0";
					document.getElementById("editRecommended").style.right = "0";
					document.getElementById("editDataset").style.left = "2000px";
					document.getElementById("editRequired").style.opacity = "0";
					document.getElementById("editDataset").style.opacity = "0";
					document.getElementById("editRecommended").style.opacity = "1";
					this.initiate_json();
				}
			}

			else if (state=='Previous'){
				$('html, body').animate({ scrollTop: 0 });
				document.getElementById("editRequired").style.left = "-3500px";
				document.getElementById("editRecommended").style.left = "0";
				document.getElementById("editRecommended").style.right = "0";
				document.getElementById("editDataset").style.left = "2000px";
				document.getElementById("editRequired").style.opacity = "0";
				document.getElementById("editDataset").style.opacity = "0";
				document.getElementById("editRecommended").style.opacity = "1";
			}
		}

		this.go_to_required = function(){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("editRecommended").style.left = "2000px";
			document.getElementById("editRequired").style.left = "0";
			document.getElementById("editRequired").style.right = "0";
			document.getElementById("editRecommended").style.opacity = "0";
			document.getElementById("editRequired").style.opacity = "1";
		}

		this.go_to_dataset = function(){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("editRecommended").style.left = "-3500px";
			document.getElementById("editDataset").style.left = "0";
			document.getElementById("editDataset").style.right = "0";
			document.getElementById("output").style.left = "2000px";		
			document.getElementById("editRecommended").style.opacity = "0";
			document.getElementById("output").style.opacity = "0";
			document.getElementById("editDataset").style.opacity = "1";
		}

		this.go_to_end = function(){
			$('html, body').animate({ scrollTop: 0 });
			document.getElementById("editDataset").style.left = "-3500px";
			document.getElementById("output").style.left = "0";
			document.getElementById("output").style.right = "0";
			document.getElementById("editDataset").style.opacity = "0";
			document.getElementById("output").style.opacity = "1";
			this.add_recommended_fields();
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



	});







	var allowed_objects = ["DataCatalog", "Dataset"];

	app.filter("prettyJSON", () => json => JSON.stringify(json, null, 4));

	app.directive('fieldEditor', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/field-editor.html'
		};
	});

	app.directive('fieldSelector', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/field-selector.html'
		};
	});

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

	app.directive('requiredFields', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/required-fields.html'
		};
	});

	app.directive('recommendedFields', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/recommended-fields.html'
		};
	});

	app.directive('datasetFields', function(){
		return {
			restrict: 'A',
			templateUrl: 'include/dataset-fields.html'
		};
	});


})();



